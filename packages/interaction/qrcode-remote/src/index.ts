/** NEXA Remote bridge and sidebar-facing Host service. */

import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { lstat, mkdir, readdir, realpath, rmdir, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, parse, resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import { Context, Service } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { RpcId, type WorkspaceId } from '@deepseek-ai/dsh-host-apiproxy'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { ApprovalOutcome, ApprovalRequest } from '@deepseek-ai/dsh-user-approval'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import QRCode from 'qrcode'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  NexaHarnessAdapter, NexaIdentity, NexaPairingChallenge, NexaPeer, RemoteHost as RemoteHostType,
} from 'nexa-remote/host'
import type * as NexaCrypto from 'nexa-remote/crypto'
import type * as NexaMessages from 'nexa-remote/messages'
import type {
  RemoteControlConfigureRequest,
  RemoteControlPairingOffer,
  RemoteControlPhase,
  RemoteControlPreferences,
  RemoteControlRevokeRequest,
  RemoteControlState,
} from './types.ts'

export type * from './types.ts'

const require = createRequire(import.meta.url)
const { RemoteHost } = require('nexa-remote/host') as typeof import('nexa-remote/host')
const Crypto = require('nexa-remote/crypto') as typeof NexaCrypto
const Messages = require('nexa-remote/messages') as typeof NexaMessages

const OFFICIAL_RELAY_URL = 'wss://relay.tppc.top'

/** Startup defaults and private-state location for the NEXA Remote Host bridge. */
export interface Config {
  /** Initial Relay connection switch when no persisted preference exists. */
  enabled?: boolean
  /** Initial Relay WebSocket endpoint when no persisted preference exists. */
  relayUrl?: string
  /** Allow users to edit the Relay endpoint. Development and self-hosting only. */
  allowCustomRelay?: boolean
  /** Initial computer name placed in pairing offers. */
  computerName?: string
  /** Private JSON file containing the computer identity, peers, and saved preferences. */
  statePath: string
  /** Extra project roots explicitly authorized by the local desktop configuration. */
  workspaceRoots?: string[]
}

interface EncodedPeer {
  devicePub: string
  deviceDhPub?: string
  txKey: string
  rxKey: string
  pairedAt?: number
  revoked?: boolean
}

interface StoredState {
  version: 1
  identity: {
    edPublicKey: string
    edSecretKey: string
    dhPublicKey: string
    dhPrivateKey: string
    deviceId: string
  }
  preferences: RemoteControlPreferences
  settingsRevision?: number
  peers: Record<string, EncodedPeer>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    remoteControl: RemoteControlService
  }
}

function normalizeRelayUrl(value: string): string {
  const trimmed = value.trim()
  let parsed: URL
  try { parsed = new URL(trimmed) } catch { throw new TypeError('remote-control: relayUrl must be a valid URL') }
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new TypeError('remote-control: relayUrl must use ws:// or wss://')
  }
  return parsed.toString().replace(/\/$/, '')
}

function normalizePreferences(input: RemoteControlConfigureRequest): RemoteControlPreferences {
  const computerName = input.computerName.trim()
  if (computerName.length === 0 || computerName.length > 80) {
    throw new TypeError('remote-control: computerName must contain 1 to 80 characters')
  }
  return Object.freeze({
    enabled: input.enabled,
    relayUrl: normalizeRelayUrl(input.relayUrl),
    computerName,
  })
}

function encodeIdentity(identity: NexaIdentity): StoredState['identity'] {
  return {
    edPublicKey: Crypto.base64urlEncode(identity.edPublicKey),
    edSecretKey: Crypto.base64urlEncode(identity.edSecretKey),
    dhPublicKey: Crypto.base64urlEncode(identity.dhPublicKey),
    dhPrivateKey: Crypto.base64urlEncode(identity.dhPrivateKey),
    deviceId: identity.deviceId,
  }
}

function decodeIdentity(value: StoredState['identity']): NexaIdentity {
  const identity = {
    edPublicKey: Crypto.base64urlDecode(value.edPublicKey),
    edSecretKey: Crypto.base64urlDecode(value.edSecretKey),
    dhPublicKey: Crypto.base64urlDecode(value.dhPublicKey),
    dhPrivateKey: Crypto.base64urlDecode(value.dhPrivateKey),
    deviceId: value.deviceId,
  }
  if (Crypto.deviceId(identity.edPublicKey) !== identity.deviceId) {
    throw new Error('remote-control: stored computer identity is inconsistent')
  }
  return identity
}

function encodePeer(peer: NexaPeer): EncodedPeer {
  return {
    devicePub: Crypto.base64urlEncode(peer.devicePub),
    ...(peer.deviceDhPub === undefined ? {} : { deviceDhPub: Crypto.base64urlEncode(peer.deviceDhPub) }),
    txKey: Crypto.base64urlEncode(peer.txKey),
    rxKey: Crypto.base64urlEncode(peer.rxKey),
    ...(peer.pairedAt === undefined ? {} : { pairedAt: peer.pairedAt }),
    ...(peer.revoked === undefined ? {} : { revoked: peer.revoked }),
  }
}

function decodePeer(peer: EncodedPeer): NexaPeer {
  return {
    devicePub: Crypto.base64urlDecode(peer.devicePub),
    ...(peer.deviceDhPub === undefined ? {} : { deviceDhPub: Crypto.base64urlDecode(peer.deviceDhPub) }),
    txKey: Crypto.base64urlDecode(peer.txKey),
    rxKey: Crypto.base64urlDecode(peer.rxKey),
    ...(peer.pairedAt === undefined ? {} : { pairedAt: peer.pairedAt }),
    ...(peer.revoked === undefined ? {} : { revoked: peer.revoked }),
  }
}

function createIdentity(): NexaIdentity {
  const generated = Crypto.generateIdentity()
  return { ...generated, deviceId: Crypto.deviceId(generated.edPublicKey) }
}

function loadState(path: string, defaults: RemoteControlPreferences): {
  identity: NexaIdentity
  peers: Map<string, NexaPeer>
  preferences: RemoteControlPreferences
  settingsRevision: number
} {
  if (!existsSync(path)) {
    return { identity: createIdentity(), peers: new Map(), preferences: defaults, settingsRevision: 1 }
  }
  const candidate = JSON.parse(readFileSync(path, 'utf8')) as {
    version?: unknown
    identity?: unknown
    preferences?: unknown
    peers?: unknown
  }
  if (candidate.version !== 1
    || candidate.identity === undefined
    || candidate.preferences === undefined
    || typeof candidate.peers !== 'object'
    || candidate.peers === null) {
    throw new Error('remote-control: unsupported or corrupt state file')
  }
  const value = candidate as unknown as StoredState
  return {
    identity: decodeIdentity(value.identity),
    peers: new Map(Object.entries(value.peers).map(([deviceId, peer]) => [deviceId, decodePeer(peer)])),
    preferences: normalizePreferences(value.preferences),
    settingsRevision: typeof value.settingsRevision === 'number' && Number.isSafeInteger(value.settingsRevision)
      && value.settingsRevision > 0 ? value.settingsRevision : 1,
  }
}

function writeState(
  path: string,
  identity: NexaIdentity,
  peers: Map<string, NexaPeer>,
  preferences: RemoteControlPreferences,
  settingsRevision: number,
): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  const encodedPeers = Object.fromEntries([...peers].map(([deviceId, peer]) => [deviceId, encodePeer(peer)]))
  writeFileSync(temporary, `${JSON.stringify({
    version: 1,
    identity: encodeIdentity(identity),
    preferences,
    settingsRevision,
    peers: encodedPeers,
  } satisfies StoredState, null, 2)}\n`, { mode: 0o600 })
  chmodSync(temporary, 0o600)
  renameSync(temporary, path)
  chmodSync(path, 0o600)
}

function eventKind(event: SessionEvent): number {
  if (event.type === 'assistant/message' || event.type === 'user/message') return Messages.EventKind.EVENT_MESSAGE
  if (event.type === 'tool/result' || event.type === 'tool/call') return Messages.EventKind.EVENT_TOOL_OUTPUT
  if (event.type.startsWith('approval/')) return Messages.EventKind.EVENT_INTERACTION
  return Messages.EventKind.EVENT_STATUS
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true
}

/** Adapter that injects phone instructions through the same ApiProxy admission path as the local UI. */
export class DshRemoteHarnessAdapter implements NexaHarnessAdapter {
  private eventCallback: Parameters<NexaHarnessAdapter['subscribeEvents']>[0] | undefined
  private readonly directoryRefs = new Map<string, { path: string; expiresAt: number }>()
  private readonly pathRefs = new Map<string, string>()
  private readonly configuredWorkspaceRoots: readonly string[]
  private readonly settingsProvider: {
    get: () => unknown
    update: (key: string, value: unknown, options: {
      expectedRevision?: number
      oldValueDigest?: string
    }) => unknown
  } | undefined

  constructor(private readonly ctx: Context, options: {
    workspaceRoots?: readonly string[]
    settings?: {
      get: () => unknown
      update: (key: string, value: unknown, options: {
        expectedRevision?: number
        oldValueDigest?: string
      }) => unknown
    }
  } = {}) {
    this.configuredWorkspaceRoots = options.workspaceRoots ?? []
    this.settingsProvider = options.settings
    ctx.on('session/event', (session, event) => {
      this.eventCallback?.({
        sessionId: session.id,
        cursor: event.seq,
        kind: eventKind(event),
        payload: { type: event.type, time: event.time, data: event.data },
      })
    })
  }

  subscribeEvents(callback: Parameters<NexaHarnessAdapter['subscribeEvents']>[0]): () => void {
    this.eventCallback = callback
    return () => { if (this.eventCallback === callback) this.eventCallback = undefined }
  }

  setApprovalRequester(_callback: (request: unknown) => Promise<number>): void {
    // Real DSH approvals enter through the approval/request waterfall below.
  }

  /** Capabilities implemented by this exact desktop build and admitted through ApiProxy. */
  getCapabilities(): string[] {
    const capabilities = [
      'session.create',
      'session.append_instruction',
      'session.stop',
      'workspace.roots.list',
      'workspace.directory.list',
      'workspace.register',
      'workspace.create',
    ]
    if (this.settingsProvider !== undefined) capabilities.push('settings.read', 'settings.write')
    return capabilities
  }

  async getSessionSnapshot(): Promise<unknown> {
    const rpcId = RpcId(`remote-snapshot-${randomUUID()}`)
    const workspaceRpcId = RpcId(`remote-workspaces-${randomUUID()}`)
    const [sessionResponse, workspaceResponse] = await Promise.all([
      this.ctx.apiProxy.sessions.list({ rpcId, payload: {} }),
      this.ctx.apiProxy.workspace.list({ rpcId: workspaceRpcId, payload: {} }),
    ])
    if (!sessionResponse.result.ok) throw new Error(sessionResponse.result.error.message)
    if (!workspaceResponse.result.ok) throw new Error(workspaceResponse.result.error.message)

    const workspaces = workspaceResponse.result.value.items
    const archived = new Set(workspaceResponse.result.value.archivedSessionIds)
    const workspaceBySession = new Map<string, string>()
    for (const workspace of workspaces) {
      for (const sessionId of workspace.sessionIds) workspaceBySession.set(sessionId, workspace.workspaceId)
    }
    const fallbackTitle = (cwd: string | undefined, sessionId: string): string => {
      if (cwd === undefined || cwd === '') return sessionId
      const parts = cwd.replace(/[/\\]+$/, '').split(/[/\\]/)
      return parts.at(-1) || sessionId
    }
    const sessions = sessionResponse.result.value.items
      .filter(item => item.origin !== 'subagent')
      .map((item) => {
        const projectedTitle = item.projections?.values.title
        return {
          sessionId: item.sessionId,
          workspaceId: workspaceBySession.get(item.sessionId) ?? '',
          title: typeof projectedTitle === 'string' && projectedTitle !== ''
            ? projectedTitle : fallbackTitle(item.cwd, item.sessionId),
          lastActiveAt: item.updatedAt,
          pinned: false,
          archived: archived.has(item.sessionId),
          cursor: item.projections?.asOfSeq ?? 0,
          pendingInteractions: 0,
          running: item.running,
          blank: item.blank,
        }
      })
    return {
      workspaces: workspaces.map(workspace => ({
        workspaceId: workspace.workspaceId,
        name: workspace.title,
        pinned: false,
        archived: false,
      })),
      sessions,
      capabilities: this.getCapabilities(),
      settingsRevision: this.settingsProvider === undefined
        ? 0
        : Number((await this.settingsProvider.get() as { revision?: unknown }).revision ?? 0),
      generatedAt: Date.now(),
    }
  }

  getSettings(): Promise<unknown> {
    const provider = this.settingsProvider
    if (provider === undefined) {
      return Promise.reject(Object.assign(
        new Error('当前电脑端版本暂不支持远程设置'),
        { code: 'CAPABILITY_UNAVAILABLE' },
      ))
    }
    return Promise.resolve().then(() => provider.get())
  }

  updateSetting(key: string, value: unknown, options: {
    expectedRevision?: number
    oldValueDigest?: string
  }): Promise<unknown> {
    const provider = this.settingsProvider
    if (provider === undefined) {
      return Promise.reject(Object.assign(
        new Error('当前电脑端版本暂不支持远程设置'),
        { code: 'CAPABILITY_UNAVAILABLE' },
      ))
    }
    return Promise.resolve().then(() => provider.update(key, value, options))
  }

  /**
   * Create an authoritative DSH Session inside an existing desktop Workspace.
   *
   * @param rawWorkspaceId - Desktop-owned Workspace identifier selected by the phone.
   */
  async createSession(
    rawWorkspaceId: string,
    _options: { title?: string; initialPrompt?: string } = {},
    meta: { commandId?: string } = {},
  ): Promise<{ sessionId: string; workspaceId: string; title: string; running: boolean }> {
    if (rawWorkspaceId.trim() === '') throw new Error('workspace not found')
    const response = await this.ctx.apiProxy.sessions.create({
      rpcId: RpcId(`remote-create-session-${meta.commandId ?? randomUUID()}`),
      payload: { workspaceId: rawWorkspaceId as WorkspaceId },
    })
    if (!response.result.ok) throw new Error(response.result.error.message)
    return {
      sessionId: response.result.value.sessionId,
      workspaceId: rawWorkspaceId,
      title: '新会话',
      running: false,
    }
  }

  private directoryRef(path: string): string {
    const now = Date.now()
    const existing = this.pathRefs.get(path)
    if (existing !== undefined) {
      const record = this.directoryRefs.get(existing)
      if (record !== undefined && record.expiresAt > now) return existing
      this.directoryRefs.delete(existing)
      this.pathRefs.delete(path)
    }
    const ref = `dir_${randomUUID().replaceAll('-', '')}`
    this.directoryRefs.set(ref, { path, expiresAt: now + 5 * 60_000 })
    this.pathRefs.set(path, ref)
    return ref
  }

  private async authorizedRoots(): Promise<Array<{ path: string; name: string; device: bigint | number }>> {
    const response = await this.ctx.apiProxy.workspace.list({
      rpcId: RpcId(`remote-workspace-roots-${randomUUID()}`),
      payload: {},
    })
    if (!response.result.ok) throw new Error(response.result.error.message)
    const candidates = [
      ...this.configuredWorkspaceRoots,
      ...response.result.value.items.map(workspace => dirname(workspace.path)),
    ]
    const roots: Array<{ path: string; name: string; device: bigint | number }> = []
    const seen = new Set<string>()
    for (const candidate of candidates) {
      try {
        if (!isAbsolute(candidate)) continue
        const direct = await lstat(candidate)
        if (!direct.isDirectory() || direct.isSymbolicLink()) continue
        const canonical = await realpath(candidate)
        if (canonical === parse(canonical).root || seen.has(canonical)) continue
        const details = await stat(canonical)
        seen.add(canonical)
        roots.push({ path: canonical, name: basename(canonical) || '项目', device: details.dev })
      } catch { /* 已删除或无权访问的本地根目录不授权给手机。 */ }
    }
    return roots
  }

  private async resolveDirectoryRef(ref: string): Promise<{
    path: string
    root: { path: string; name: string; device: bigint | number }
  }> {
    const record = this.directoryRefs.get(ref)
    if (record === undefined || record.expiresAt <= Date.now()) {
      if (record !== undefined) {
        this.directoryRefs.delete(ref)
        this.pathRefs.delete(record.path)
      }
      throw Object.assign(new Error('目录引用已过期，请重新打开工作区选择器'), { code: 'EXPIRED' })
    }
    const direct = await lstat(record.path)
    if (!direct.isDirectory() || direct.isSymbolicLink()) {
      throw Object.assign(new Error('所选目录不再可用'), { code: 'NOT_FOUND' })
    }
    const canonical = await realpath(record.path)
    if (canonical !== record.path) {
      throw Object.assign(new Error('目录边界已变化，请重新选择'), { code: 'OUTSIDE_ALLOWED_ROOT' })
    }
    const roots = await this.authorizedRoots()
    const root = roots.find(candidate => canonical === candidate.path || canonical.startsWith(`${candidate.path}${sep}`))
    if (root === undefined) {
      throw Object.assign(new Error('目录不在电脑授权的项目范围内'), { code: 'OUTSIDE_ALLOWED_ROOT' })
    }
    const details = await stat(canonical)
    if (details.dev !== root.device) {
      throw Object.assign(new Error('不允许跨越电脑授权的文件系统边界'), { code: 'OUTSIDE_ALLOWED_ROOT' })
    }
    record.expiresAt = Date.now() + 5 * 60_000
    return { path: canonical, root }
  }

  async listWorkspaceRoots(): Promise<{
    roots: Array<{ rootId: string; name: string; directoryRef: string }>
  }> {
    const roots = await this.authorizedRoots()
    return {
      roots: roots.map(root => ({
        rootId: `root_${Crypto.base32Encode(Crypto.sha256(Crypto.utf8Bytes(root.path))).slice(0, 12).toLowerCase()}`,
        name: root.name,
        directoryRef: this.directoryRef(root.path),
      })),
    }
  }

  /**
   * List child project directories behind a short-lived opaque desktop reference.
   *
   * @param rawDirectoryRef - Opaque directory reference previously issued by this desktop.
   */
  async listDirectory(rawDirectoryRef: string): Promise<{
    directory: { directoryRef: string; name: string; canSelect: boolean; parentDirectoryRef: string }
    entries: Array<{ directoryRef: string; name: string; kind: 'directory'; canSelect: boolean }>
    nextCursor: null
  }> {
    const current = await this.resolveDirectoryRef(rawDirectoryRef)
    const rows = await readdir(current.path, { withFileTypes: true })
    const entries: Array<{ directoryRef: string; name: string; kind: 'directory'; canSelect: boolean }> = []
    const blocked = /^(?:\.git|\.ssh|\.gnupg|\.aws|\.azure|\.config|\.env.*|Library|node_modules)$/i
    for (const row of rows) {
      if (!row.isDirectory() || row.isSymbolicLink() || blocked.test(row.name) || row.name.startsWith('.')) continue
      const path = join(current.path, row.name)
      try {
        const details = await lstat(path)
        if (!details.isDirectory() || details.isSymbolicLink() || details.dev !== current.root.device) continue
        const canonical = await realpath(path)
        if (canonical !== path || !canonical.startsWith(`${current.root.path}${sep}`)) continue
        entries.push({ directoryRef: this.directoryRef(canonical), name: row.name, kind: 'directory', canSelect: true })
      } catch { /* 竞态中消失或无权访问的子目录直接省略。 */ }
      if (entries.length >= 200) break
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    const parentPath = dirname(current.path)
    return {
      directory: {
        directoryRef: rawDirectoryRef,
        name: basename(current.path) || current.root.name,
        canSelect: true,
        parentDirectoryRef: current.path === current.root.path ? '' : this.directoryRef(parentPath),
      },
      entries,
      nextCursor: null,
    }
  }

  private workspaceResult(value: {
    workspace: { workspaceId: WorkspaceId; title: string }
    created: boolean
  }): { workspace: { workspaceId: string; name: string }; created: boolean } {
    return {
      workspace: { workspaceId: value.workspace.workspaceId, name: value.workspace.title },
      created: value.created,
    }
  }

  /**
   * Register an existing desktop directory as a DSH Workspace.
   *
   * @param rawDirectoryRef - Opaque directory reference selected by the phone.
   */
  async registerWorkspace(rawDirectoryRef: string, meta: { commandId?: string } = {}): Promise<{
    workspace: { workspaceId: string; name: string }
    created: boolean
  }> {
    const directory = await this.resolveDirectoryRef(rawDirectoryRef)
    const response = await this.ctx.apiProxy.workspace.create({
      rpcId: RpcId(`remote-register-workspace-${meta.commandId ?? randomUUID()}`),
      payload: { path: directory.path },
    })
    if (!response.result.ok) throw new Error(response.result.error.message)
    return this.workspaceResult(response.result.value)
  }

  /**
   * Create and register a desktop project directory under an authorized parent.
   *
   * @param rawParentRef - Opaque reference for the authorized desktop parent directory.
   * @param rawName - Single new directory name supplied by the phone.
   */
  async createWorkspace(rawParentRef: string, rawName: string, meta: { commandId?: string } = {}): Promise<{
    workspace: { workspaceId: string; name: string }
    created: boolean
  }> {
    const parent = await this.resolveDirectoryRef(rawParentRef)
    const name = rawName.normalize('NFC').trim()
    if (name === '' || name === '.' || name === '..' || /[/\\\0]/.test(name) || name.startsWith('.')) {
      throw Object.assign(new Error('文件夹名称必须是不以点开头的单一合法名称'), { code: 'NAME_INVALID' })
    }
    const target = resolve(parent.path, name)
    if (target !== join(parent.path, name) || !target.startsWith(`${parent.root.path}${sep}`)) {
      throw Object.assign(new Error('目标目录超出电脑授权范围'), { code: 'OUTSIDE_ALLOWED_ROOT' })
    }
    try {
      await mkdir(target, { mode: 0o755 })
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
      if (code === 'EEXIST') throw Object.assign(new Error('同名文件夹已存在'), { code: 'DIRECTORY_EXISTS' })
      throw error
    }
    try {
      const directoryRef = this.directoryRef(target)
      await this.resolveDirectoryRef(directoryRef)
      return await this.registerWorkspace(directoryRef, meta)
    } catch (error) {
      try { await rmdir(target) } catch { /* 只回滚仍为空的本次新建目录。 */ }
      throw error
    }
  }

  /**
   * Read a bounded authoritative event page for one remotely addressed Session.
   * @param rawSessionId - Session identity received from the authenticated phone command.
   * @param options - Optional exclusive cursor and bounded page size.
   * @returns projected events and whether older history remains available.
   */
  async getSessionHistory(
    rawSessionId: string,
    options: { beforeCursor?: number; maxMessages?: number } = {},
  ): Promise<{
    events: Array<{ sessionId: string; cursor: number; kind: number; payload: unknown }>
    hasMore: boolean
  }> {
    const sessionId = rawSessionId as SessionId
    const response = await this.ctx.apiProxy.sessions.history({
      rpcId: RpcId(`remote-history-${randomUUID()}`),
      payload: {
        sessionId,
        ...(options.beforeCursor === undefined ? {} : { beforeSeq: options.beforeCursor }),
        maxMessages: Math.max(1, Math.min(100, options.maxMessages ?? 30)),
      },
    })
    if (!response.result.ok) throw new Error(response.result.error.message)
    return {
      events: response.result.value.events.map(entry => ({
        sessionId,
        cursor: entry.event.seq,
        kind: eventKind(entry.event),
        payload: {
          type: entry.event.type,
          time: entry.event.time,
          data: entry.event.data,
          ...(entry.view === undefined ? {} : { view: entry.view }),
        },
      })),
      hasMore: response.result.value.hasMore,
    }
  }

  /**
   * Admit one phone command through the existing Session API.
   * @param rawSessionId - session selected by the paired phone.
   * @param text - user instruction for an append action.
   * @param meta - authenticated NEXA command identity and action.
   * @returns final accepted or rejected command status after the Agent becomes idle.
   */
  async executeCommand(
    rawSessionId: string,
    text: string,
    meta: { commandId: string; action: string },
  ): Promise<{ status: 'completed' | 'rejected'; result: string }> {
    const sessionId = rawSessionId as SessionId
    try {
      // Compatibility path for a desktop build still resolving an older nexa-remote Host:
      // newer Hosts intercept these read-only actions and send typed snapshot/batch bodies;
      // older Hosts reach this adapter, so return the same authority data in CommandResult.
      if (meta.action === 'sync_index') {
        return { status: 'completed', result: JSON.stringify(await this.getSessionSnapshot()) }
      }
      if (meta.action === 'sync_history') {
        const parsed = text === '' ? {} : JSON.parse(text) as { beforeCursor?: number; maxMessages?: number }
        return {
          status: 'completed',
          result: JSON.stringify({
            sessionId,
            ...await this.getSessionHistory(sessionId, parsed),
            history: true,
          }),
        }
      }
      if (meta.action === 'stop') {
        const response = await this.ctx.apiProxy.sessions.cancel({
          rpcId: RpcId(`remote-stop-${meta.commandId}`),
          payload: { sessionId },
        })
        if (!response.result.ok) return { status: 'rejected', result: response.result.error.message }
        await this.ctx.agents.get(sessionId)?.whenIdle()
        return { status: 'completed', result: 'stopped' }
      }
      if (meta.action !== 'append_instruction') {
        return { status: 'rejected', result: `unsupported remote action: ${meta.action}` }
      }
      const response = await this.ctx.apiProxy.sessions.prompt({
        rpcId: RpcId(`remote-command-${meta.commandId}`),
        payload: { sessionId, mode: 'queue', content: [{ type: 'text', text }] },
      })
      if (!response.result.ok) return { status: 'rejected', result: response.result.error.message }
      await this.ctx.agents.get(sessionId)?.whenIdle()
      return { status: 'completed', result: 'completed' }
    } catch (error: unknown) {
      return { status: 'rejected', result: error instanceof Error ? error.message : String(error) }
    }
  }
}

/** Host-owned remote connection, pairing state, and typed settings actions. */
export class RemoteControlService extends TypertRemoteService {
  static inject = ['agents', 'apiProxy']

  static Config: s<Config> = s.object({
    enabled: s.boolean().default(true),
    relayUrl: s.string().default(OFFICIAL_RELAY_URL),
    allowCustomRelay: s.boolean().default(false),
    computerName: s.string().default('DeepSeek Harness NEXA'),
    statePath: s.string().required(),
    workspaceRoots: s.array(s.string()).default([]),
  })

  private readonly statePath: string
  private readonly identity: NexaIdentity
  private readonly peers: Map<string, NexaPeer>
  private readonly harness: DshRemoteHarnessAdapter
  private readonly managedRelayUrl: string
  private readonly allowCustomRelay: boolean
  private preferences: RemoteControlPreferences
  private settingsRevision: number
  private host: RemoteHostType | undefined
  private phase: RemoteControlPhase = 'disconnected'
  private error: string | undefined
  private generation = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private reconnectDelayMs = 1_000

  constructor(ctx: Context, config: Config) {
    super(ctx, 'remoteControl')
    this.statePath = config.statePath
    this.managedRelayUrl = normalizeRelayUrl(config.relayUrl ?? OFFICIAL_RELAY_URL)
    this.allowCustomRelay = config.allowCustomRelay ?? false
    const defaults = normalizePreferences({
      enabled: config.enabled ?? true,
      relayUrl: this.managedRelayUrl,
      computerName: config.computerName ?? 'DeepSeek Harness NEXA',
    })
    const loaded = loadState(this.statePath, defaults)
    this.identity = loaded.identity
    this.peers = loaded.peers
    this.preferences = normalizePreferences({
      ...loaded.preferences,
      relayUrl: this.allowCustomRelay ? loaded.preferences.relayUrl : this.managedRelayUrl,
    })
    this.settingsRevision = loaded.settingsRevision
    this.harness = new DshRemoteHarnessAdapter(ctx, {
      ...(config.workspaceRoots === undefined ? {} : { workspaceRoots: config.workspaceRoots }),
      settings: {
        get: () => this.settingsSnapshot(),
        update: (key, value, options) => this.updateRemoteSetting(key, value, options),
      },
    })
    this.persist()

    ctx.effect(() => () => {
      this.generation++
      this.clearReconnectTimer()
      this.host?.close()
      this.host = undefined
    }, 'remote-control: host lifecycle')

    ctx.on('approval/request', (request, next) => this.answerApproval(request, next), { prepend: true })
  }

  protected [Service.init](): void {
    void this.restart()
  }

  /**
   * Project the current control plane without private key material.
   * @returns current browser-safe connection, pairing, and device state.
   */
  @Remote('state')
  state(): RemoteControlState {
    const pending = this.host?.pendingProposal
    const pendingDevice = pending === null || pending === undefined ? undefined : {
      deviceId: pending.deviceId,
      fingerprint: Crypto.base32Encode(Crypto.sha256(Crypto.base64urlDecode(pending.devicePub))).slice(0, 8),
      expiresAt: pending.expiresAt,
    }
    return Object.freeze({
      phase: this.phase,
      relayMode: this.allowCustomRelay ? 'custom' : 'managed',
      preferences: { ...this.preferences },
      computerId: this.identity.deviceId,
      pairedDevices: this.host?.pairedDevices() ?? [...this.peers].map(([deviceId, peer]) => ({
        deviceId,
        pairedAt: peer.pairedAt ?? 0,
        revoked: !!peer.revoked,
      })),
      ...(pendingDevice === undefined ? {} : { pendingDevice }),
      ...(this.error === undefined ? {} : { error: this.error }),
    })
  }

  /**
   * Persist preferences and restart the Relay connection.
   * @param request - complete replacement preference set from settings.
   * @returns state after the restart attempt settles.
   */
  @Remote('configure')
  async configure(request: RemoteControlConfigureRequest): Promise<RemoteControlState> {
    const next = normalizePreferences({
      ...request,
      relayUrl: this.allowCustomRelay ? request.relayUrl : this.managedRelayUrl,
    })
    if (next.enabled !== this.preferences.enabled
      || next.relayUrl !== this.preferences.relayUrl
      || next.computerName !== this.preferences.computerName) this.settingsRevision += 1
    this.preferences = next
    this.persist()
    await this.restart()
    return this.state()
  }

  /**
   * Retry the currently configured Relay immediately.
   * @returns state after an explicit Relay reconnection attempt settles.
   */
  @Remote('reconnect')
  async reconnect(): Promise<RemoteControlState> {
    await this.restart()
    return this.state()
  }

  /**
   * Open a computer-side pairing window and authorize only that fresh challenge.
   * @returns expiring Mini Program payload and rendered QR data URL.
   */
  @Remote('openPairing')
  async openPairing(): Promise<RemoteControlPairingOffer> {
    if (this.phase !== 'connected' || this.host?.isConnected() !== true) await this.restart()
    if (this.phase !== 'connected' || this.host?.isConnected() !== true) {
      throw new Error(this.error ?? 'remote-control: relay is not connected')
    }
    const challenge = await this.host.openPairing({
      computerName: this.preferences.computerName,
      authorizePairing: true,
    })
    const payload = this.pairingPayload(challenge)
    const miniProgramCode = challenge.launch?.mode === 'miniprogram-code'
      ? challenge.launch.imageDataUrl
      : undefined
    return {
      payload,
      qrDataUrl: miniProgramCode
        ?? await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 280 }),
      mode: miniProgramCode === undefined ? 'fallback-qr' : 'miniprogram-code',
      ...(challenge.launch?.reason === undefined ? {} : { fallbackReason: challenge.launch.reason }),
      fingerprint: challenge.computerPubFingerprint,
      computerName: challenge.computerName,
      expiresAt: challenge.expiresAt,
    }
  }

  /**
   * Accept the phone proposal currently visible to the user.
   * @returns state after confirming the currently pending phone proposal.
   */
  @Remote('confirmPairing')
  confirmPairing(): RemoteControlState {
    if (this.host?.confirmPendingPairing() !== true) {
      throw new Error('remote-control: no valid pairing request is waiting for confirmation')
    }
    return this.state()
  }

  /**
   * Revoke one known phone and persist the invalidated peer.
   * @param request - device identity selected in settings.
   * @returns state containing the revoked device marker.
   */
  @Remote('revoke')
  revoke(request: RemoteControlRevokeRequest): RemoteControlState {
    if (!this.peers.has(request.deviceId)) throw new Error('remote-control: paired device was not found')
    this.host?.revoke(request.deviceId)
    const peer = this.peers.get(request.deviceId)
    if (peer !== undefined) peer.revoked = true
    this.persist()
    return this.state()
  }

  private pairingPayload(challenge: NexaPairingChallenge): string {
    return `NEXA:${Crypto.base32Encode(Messages.encodePairingChallenge(challenge))}`
  }

  private async restart(): Promise<void> {
    const generation = ++this.generation
    this.clearReconnectTimer()
    this.host?.close()
    this.host = undefined
    this.error = undefined
    if (!this.preferences.enabled) {
      this.phase = 'disabled'
      return
    }
    this.phase = 'connecting'
    const host = new RemoteHost({
      identity: this.identity,
      relayUrl: this.preferences.relayUrl,
      peerStore: this.peers,
      harness: this.harness,
      log: this.ctx.logger,
      onPeerChanged: () => { this.persist() },
      onConnectionChange: (connected: boolean) => {
        if (generation !== this.generation || this.host !== host) return
        if (connected) {
          this.phase = 'connected'
          this.error = undefined
          this.reconnectDelayMs = 1_000
          this.clearReconnectTimer()
          return
        }
        if (!this.preferences.enabled) return
        this.phase = 'disconnected'
        this.scheduleReconnect(generation)
      },
    })
    host.onPairingPendingUser = () => { /* state() reads pendingProposal directly */ }
    this.host = host
    try {
      await host.start()
      if (generation !== this.generation) {
        host.close()
        return
      }
      this.phase = 'connected'
      this.error = undefined
      this.reconnectDelayMs = 1_000
    } catch (error: unknown) {
      if (generation !== this.generation) return
      host.close()
      this.host = undefined
      this.phase = 'error'
      this.error = error instanceof Error ? error.message : String(error)
      this.scheduleReconnect(generation)
    }
  }

  /** Keep the managed Relay connection alive without exposing connection plumbing to users. */
  private scheduleReconnect(generation: number): void {
    if (!this.preferences.enabled || generation !== this.generation || this.reconnectTimer !== undefined) return
    const delay = this.reconnectDelayMs
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 15_000)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      if (generation !== this.generation || !this.preferences.enabled) return
      void this.restart()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === undefined) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
  }

  private settingsSnapshot(): {
    revision: number
    sections: Array<{
      id: string
      title: string
      items: Array<{
        key: string
        title: string
        description: string
        type: 'text' | 'boolean'
        value: string | boolean
        risk: 'remote-editable' | 'local-only'
        revision: number
      }>
    }>
  } {
    const revision = this.settingsRevision
    return {
      revision,
      sections: [
        {
          id: 'computer',
          title: '这台电脑',
          items: [{
            key: 'remote.computerName',
            title: '电脑名称',
            description: '用于在微信小程序中识别这台电脑。',
            type: 'text',
            value: this.preferences.computerName,
            risk: 'remote-editable',
            revision,
          }],
        },
        {
          id: 'security',
          title: '连接与安全',
          items: [{
            key: 'remote.enabled',
            title: '允许移动端连接',
            description: '为保护电脑安全，此项只能在电脑端修改。',
            type: 'boolean',
            value: this.preferences.enabled,
            risk: 'local-only',
            revision,
          }],
        },
      ],
    }
  }

  private updateRemoteSetting(key: string, value: unknown, options: {
    expectedRevision?: number
    oldValueDigest?: string
  }): ReturnType<RemoteControlService['settingsSnapshot']> {
    if (options.expectedRevision !== this.settingsRevision) {
      throw Object.assign(new Error('设置已在电脑端更新，请刷新后重试'), { code: 'REVISION_CONFLICT' })
    }
    if (key !== 'remote.computerName') {
      throw Object.assign(new Error('该设置只能在电脑端修改'), { code: 'LOCAL_ONLY' })
    }
    const oldValueDigest = Crypto.base64urlEncode(Crypto.sha256(
      Crypto.utf8Bytes(JSON.stringify(this.preferences.computerName)),
    ))
    if (options.oldValueDigest === undefined || options.oldValueDigest !== oldValueDigest) {
      throw Object.assign(new Error('设置原值已变化，请刷新后重试'), { code: 'VALUE_CONFLICT' })
    }
    if (typeof value !== 'string') {
      throw Object.assign(new Error('电脑名称格式无效'), { code: 'INVALID_REQUEST' })
    }
    const computerName = value.trim()
    if (computerName.length === 0 || computerName.length > 80) {
      throw Object.assign(new Error('电脑名称应为 1 至 80 个字符'), { code: 'INVALID_REQUEST' })
    }
    if (computerName !== this.preferences.computerName) {
      this.preferences = normalizePreferences({ ...this.preferences, computerName })
      this.settingsRevision += 1
      this.persist()
    }
    return this.settingsSnapshot()
  }

  private persist(): void {
    writeState(this.statePath, this.identity, this.peers, this.preferences, this.settingsRevision)
  }

  private async answerApproval(
    request: ApprovalRequest,
    next: () => Promise<ApprovalOutcome>,
  ): Promise<ApprovalOutcome> {
    const host = this.host
    if (this.phase !== 'connected' || host?.activePeerId() === null || host?.activePeerId() === undefined) {
      return next()
    }
    const signal = request.signal
    if (isAborted(signal)) return 'cancelled'
    const createdAt = Date.now()
    const expiresAt = createdAt + 2 * 60 * 1000
    const requestDigest = Crypto.base64urlEncode(Crypto.sha256(Crypto.utf8Bytes(JSON.stringify({
      sessionId: request.agent.id,
      toolName: request.toolName,
      callId: request.callId,
      reason: request.reason,
    }))))
    try {
      const remoteDecision = host.requestApproval({
        approvalId: `dsh-${randomUUID()}`,
        workspaceId: request.agent.session.header.cwd ?? '',
        sessionId: request.agent.id,
        actionCategory: request.toolName,
        target: request.reason ?? request.toolName,
        scope: 'allow-once',
        level: 'high',
        requestDigest,
        createdAt,
        expiresAt,
      })
      let decision: number
      if (signal === undefined) {
        decision = await remoteDecision
      } else {
        const aborted = Promise.withResolvers<number>()
        const onAbort = (): void => { aborted.resolve(Messages.Decision.DECISION_DENY) }
        signal.addEventListener('abort', onAbort, { once: true })
        try {
          decision = await Promise.race([remoteDecision, aborted.promise])
        } finally {
          signal.removeEventListener('abort', onAbort)
        }
      }
      if (isAborted(signal)) return 'cancelled'
      return decision === Messages.Decision.DECISION_ALLOW_ONCE ? 'allowed-once' : 'rejected'
    } catch {
      return next()
    }
  }
}

export default RemoteControlService
