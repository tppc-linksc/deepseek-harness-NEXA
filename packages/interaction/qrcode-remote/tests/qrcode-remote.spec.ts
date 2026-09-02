import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import RemoteControlService, { DshRemoteHarnessAdapter } from '../src/index.ts'

const contexts: Context[] = []
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  for (const path of temporaryDirectories.splice(0)) rmSync(path, { recursive: true, force: true })
})

function disabledHarness(): { ctx: Context; path: string } {
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide('agents', { get: () => undefined } as never)
  ctx.provide('apiProxy', { sessions: {} } as never)
  const directory = mkdtempSync(join(tmpdir(), 'dsh-remote-control-'))
  temporaryDirectories.push(directory)
  return { ctx, path: join(directory, 'state.json') }
}

describe('RemoteControlService', () => {
  it('persists private state with owner-only permissions and exposes no channel secret', async () => {
    const { ctx, path } = disabledHarness()
    await ctx.plugin(RemoteControlService, {
      enabled: false,
      relayUrl: 'ws://127.0.0.1:8080',
      computerName: 'Test computer',
      statePath: path,
    }).await()
    const service = ctx.get('remoteControl') as RemoteControlService

    expect(remoteMethods(service).map(entry => entry.method)).toEqual([
      'state', 'configure', 'reconnect', 'openPairing', 'confirmPairing', 'revoke',
    ])
    expect(service.state()).toMatchObject({
      phase: 'disabled',
      relayMode: 'managed',
      preferences: { enabled: false, computerName: 'Test computer' },
      pairedDevices: [],
    })
    expect(JSON.stringify(service.state())).not.toMatch(/secret|private|txKey|rxKey/i)
    expect(statSync(path).mode & 0o777).toBe(0o600)
    const stored = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    expect(stored).toHaveProperty('identity')
    expect(service.state()).not.toHaveProperty('identity')
  })

  it('validates settings before replacing the persisted preference', async () => {
    const { ctx, path } = disabledHarness()
    await ctx.plugin(RemoteControlService, {
      enabled: false,
      relayUrl: 'ws://127.0.0.1:8080',
      allowCustomRelay: true,
      statePath: path,
    }).await()
    const service = ctx.get('remoteControl') as RemoteControlService

    await expect(service.configure({
      enabled: false,
      relayUrl: 'https://relay.example.com',
      computerName: 'Computer',
    })).rejects.toThrow(/ws:\/\/ or wss:\/\//)
    expect(service.state().preferences.relayUrl).toBe('ws://127.0.0.1:8080')

    await expect(service.configure({
      enabled: false,
      relayUrl: 'wss://relay.example.com/',
      computerName: '  My computer  ',
    })).resolves.toMatchObject({
      phase: 'disabled',
      preferences: {
        enabled: false,
        relayUrl: 'wss://relay.example.com',
        computerName: 'My computer',
      },
    })
  })

  it('exposes an allowlisted remote settings schema with revision conflict protection', async () => {
    const { ctx, path } = disabledHarness()
    await ctx.plugin(RemoteControlService, {
      enabled: false,
      relayUrl: 'wss://relay.tppc.top',
      computerName: 'Original computer',
      statePath: path,
    }).await()
    const service = ctx.get('remoteControl') as RemoteControlService
    const adapter = (service as unknown as { harness: DshRemoteHarnessAdapter }).harness
    const settings = await adapter.getSettings() as {
      revision: number
      sections: Array<{ items: Array<{ key: string; value: unknown; risk: string }> }>
    }
    const items = settings.sections.flatMap(section => section.items)
    const name = items.find(item => item.key === 'remote.computerName')!
    const enabled = items.find(item => item.key === 'remote.enabled')!
    expect(name.risk).toBe('remote-editable')
    expect(enabled.risk).toBe('local-only')
    expect(adapter.getCapabilities()).toContain('settings.write')

    const oldValueDigest = createHash('sha256')
      .update(JSON.stringify(name.value))
      .digest('base64url')
    const updated = await adapter.updateSetting('remote.computerName', 'Remote computer', {
      expectedRevision: settings.revision,
      oldValueDigest,
    }) as { revision: number }
    expect(updated.revision).toBe(settings.revision + 1)
    expect(service.state().preferences.computerName).toBe('Remote computer')
    await expect(adapter.updateSetting('remote.computerName', 'Stale overwrite', {
      expectedRevision: settings.revision,
      oldValueDigest,
    })).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
    await expect(adapter.updateSetting('remote.enabled', true, {
      expectedRevision: updated.revision,
      oldValueDigest: createHash('sha256').update('false').digest('base64url'),
    })).rejects.toMatchObject({ code: 'LOCAL_ONLY' })

    const stored = JSON.parse(readFileSync(path, 'utf8')) as { settingsRevision?: number }
    expect(stored.settingsRevision).toBe(updated.revision)
  })

  it('keeps the managed Relay fixed even when a browser submits another URL', async () => {
    const { ctx, path } = disabledHarness()
    await ctx.plugin(RemoteControlService, {
      enabled: false,
      relayUrl: 'wss://relay.tppc.top',
      statePath: path,
    }).await()
    const service = ctx.get('remoteControl') as RemoteControlService

    await expect(service.configure({
      enabled: false,
      relayUrl: 'ws://127.0.0.1:8080',
      computerName: 'Managed computer',
    })).resolves.toMatchObject({
      relayMode: 'managed',
      preferences: { relayUrl: 'wss://relay.tppc.top' },
    })
  })

  it('fails closed when the private state file has an invalid shape', async () => {
    const { ctx, path } = disabledHarness()
    writeFileSync(path, JSON.stringify({ version: 1, identity: {}, preferences: {}, peers: null }))

    await expect(ctx.plugin(RemoteControlService, {
      enabled: false,
      statePath: path,
    }).await()).rejects.toThrow('unsupported or corrupt state file')
  })
})

describe('DshRemoteHarnessAdapter', () => {
  it('projects only remote Host workspaces, task summaries, and authoritative history', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const listSessions = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        value: {
          items: [
            {
              sessionId: 'session-1', cwd: '/work/NEXA-Remote', updatedAt: 100,
              running: true, blank: false,
              projections: { asOfSeq: 8, values: { title: '同步移动端历史' } },
            },
            {
              sessionId: 'session-new', cwd: '/work/NEXA-Remote', updatedAt: 101,
              running: false, blank: true,
              projections: { asOfSeq: 0, values: { title: '新会话' } },
            },
            {
              sessionId: 'subagent-1', cwd: '/work/NEXA-Remote', updatedAt: 90,
              running: false, blank: false, origin: 'subagent',
            },
            {
              sessionId: 'orphan-1', cwd: '/work/Removed', updatedAt: 89,
              running: false, blank: false,
              projections: { asOfSeq: 1, values: { title: '已移除会话' } },
            },
          ],
        },
      },
    })
    const listWorkspaces = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        value: {
          items: [{
            workspaceId: 'workspace-1', path: '/work/NEXA-Remote', title: 'NEXA-Remote',
            sessionIds: ['session-1', 'session-new'], createdAt: '2026-08-22T00:00:00Z', updatedAt: '2026-08-22T00:00:00Z',
          }],
          archivedSessionIds: [],
        },
      },
    })
    const history = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        value: {
          events: [{
            event: { seq: 7, type: 'assistant/message', time: 123, data: { message: { content: [{ type: 'text', text: '完成' }] } } },
          }],
          hasMore: true,
        },
      },
    })
    ctx.provide('agents', { get: () => undefined } as never)
    ctx.provide('apiProxy', {
      sessions: { list: listSessions, history },
      workspace: { list: listWorkspaces },
    } as never)
    const adapter = new DshRemoteHarnessAdapter(ctx)

    await expect(adapter.getSessionSnapshot()).resolves.toMatchObject({
      capabilities: [
        'session.create',
        'session.append_instruction',
        'session.stop',
        'workspace.roots.list',
        'workspace.directory.list',
        'workspace.register',
        'workspace.create',
      ],
      workspaces: [{ workspaceId: 'workspace-1', name: 'NEXA-Remote' }],
      sessions: [{
        sessionId: 'session-1', workspaceId: 'workspace-1', title: '同步移动端历史',
        cursor: 8, running: true, blank: false,
      }, {
        sessionId: 'session-new', workspaceId: 'workspace-1', title: '新会话',
        cursor: 0, running: false, blank: true,
      }],
    })
    const snapshot = await adapter.getSessionSnapshot() as { sessions: Array<{ sessionId: string }> }
    expect(snapshot.sessions.map(session => session.sessionId)).toEqual(['session-1', 'session-new'])
    await expect(adapter.getSessionHistory('session-1', { beforeCursor: 8, maxMessages: 30 }))
      .resolves.toMatchObject({
        events: [{ sessionId: 'session-1', cursor: 7, payload: { type: 'assistant/message', time: 123 } }],
        hasMore: true,
      })
    expect(history).toHaveBeenCalledWith(expect.objectContaining({
      payload: { sessionId: 'session-1', beforeSeq: 8, maxMessages: 30 },
    }))
    const compatibility = await adapter.executeCommand(
      'session-1', '{"beforeCursor":8,"maxMessages":30}',
      { commandId: 'sync-history-compat', action: 'sync_history' },
    )
    expect(compatibility.status).toBe('completed')
    expect(JSON.parse(compatibility.result)).toMatchObject({
      sessionId: 'session-1', history: true, hasMore: true,
      events: [{ sessionId: 'session-1', cursor: 7 }],
    })
  })

  it('creates a real Session through ApiProxy inside the selected Workspace', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const create = vi.fn().mockResolvedValue({
      result: { ok: true, value: { sessionId: 'session-mobile-1' } },
    })
    ctx.provide('agents', { get: () => undefined } as never)
    ctx.provide('apiProxy', { sessions: { create } } as never)
    const created: Array<[string, string]> = []
    ctx.on('remote-control/session-created', (sessionId, workspaceId) => {
      created.push([sessionId, workspaceId])
    })
    const adapter = new DshRemoteHarnessAdapter(ctx)

    await expect(adapter.createSession('workspace-1', {}, { commandId: 'create-1' }))
      .resolves.toEqual({
        sessionId: 'session-mobile-1',
        workspaceId: 'workspace-1',
        title: '新会话',
        running: false,
      })
    expect(create).toHaveBeenCalledWith({
      rpcId: 'remote-create-session-create-1',
      payload: { workspaceId: 'workspace-1' },
    })
    expect(created).toEqual([['session-mobile-1', 'workspace-1']])
  })

  it('browses only authorized directories through opaque references and registers desktop workspaces', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const root = mkdtempSync(join(tmpdir(), 'dsh-remote-workspaces-'))
    temporaryDirectories.push(root)
    const projects = join(root, 'projects')
    const existing = join(projects, 'NEXA-Remote')
    const other = join(projects, 'Other')
    const outside = join(root, 'outside')
    mkdirSync(existing, { recursive: true })
    mkdirSync(other)
    mkdirSync(outside)
    symlinkSync(outside, join(projects, 'outside-link'))

    const list = vi.fn().mockResolvedValue({
      result: {
        ok: true,
        value: {
          items: [{
            workspaceId: 'workspace-1', path: existing, title: 'NEXA-Remote',
            sessionIds: [], createdAt: '2026-08-24T00:00:00Z', updatedAt: '2026-08-24T00:00:00Z',
          }],
          archivedSessionIds: [],
        },
      },
    })
    const create = vi.fn(async ({ payload }: { payload: { path: string } }) => ({
      result: {
        ok: true,
        value: {
          workspace: {
            workspaceId: `workspace-${payload.path.split('/').at(-1)}`, path: payload.path,
            title: payload.path.split('/').at(-1) ?? 'workspace', sessionIds: [],
            createdAt: '2026-08-24T00:00:00Z', updatedAt: '2026-08-24T00:00:00Z',
          },
          created: true,
        },
      },
    }))
    ctx.provide('agents', { get: () => undefined } as never)
    ctx.provide('apiProxy', { workspace: { list, create }, sessions: {} } as never)
    const adapter = new DshRemoteHarnessAdapter(ctx)

    const roots = await adapter.listWorkspaceRoots()
    expect(roots.roots).toHaveLength(1)
    expect(JSON.stringify(roots)).not.toContain(projects)
    const directory = await adapter.listDirectory(roots.roots[0]!.directoryRef)
    expect(directory.entries.map(entry => entry.name)).toEqual(['NEXA-Remote', 'Other'])
    expect(JSON.stringify(directory)).not.toContain(projects)

    const otherRef = directory.entries.find(entry => entry.name === 'Other')!.directoryRef
    await expect(adapter.registerWorkspace(otherRef, { commandId: 'register-1' })).resolves.toEqual({
      workspace: { workspaceId: 'workspace-Other', name: 'Other' },
      created: true,
    })
    expect(create).toHaveBeenCalledWith({
      rpcId: 'remote-register-workspace-register-1',
      payload: { path: realpathSync(other) },
    })

    await expect(adapter.createWorkspace(roots.roots[0]!.directoryRef, 'New Project', { commandId: 'create-workspace-1' }))
      .resolves.toEqual({
        workspace: { workspaceId: 'workspace-New Project', name: 'New Project' },
        created: true,
      })
    expect(statSync(join(projects, 'New Project')).isDirectory()).toBe(true)
    await expect(adapter.createWorkspace(roots.roots[0]!.directoryRef, '../escape'))
      .rejects.toMatchObject({ code: 'NAME_INVALID' })
  })

  it('admits instructions through ApiProxy and waits for the addressed Agent', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const whenIdle = vi.fn().mockResolvedValue(undefined)
    const prompt = vi.fn().mockResolvedValue({ result: { ok: true, value: {} } })
    ctx.provide('agents', { get: () => ({ whenIdle }) } as never)
    ctx.provide('apiProxy', { sessions: { prompt } } as never)
    const adapter = new DshRemoteHarnessAdapter(ctx)

    await expect(adapter.executeCommand('session-1', 'continue', {
      commandId: 'command-1', action: 'append_instruction',
    })).resolves.toEqual({ status: 'completed', result: 'completed' })
    expect(prompt).toHaveBeenCalledWith({
      rpcId: 'remote-command-command-1',
      payload: {
        sessionId: 'session-1',
        mode: 'queue',
        content: [{ type: 'text', text: 'continue' }],
      },
    })
    expect(whenIdle).toHaveBeenCalledOnce()
  })

  it('rejects actions outside the deliberately narrow phone command vocabulary', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide('agents', { get: () => undefined } as never)
    ctx.provide('apiProxy', { sessions: {} } as never)
    const adapter = new DshRemoteHarnessAdapter(ctx)

    await expect(adapter.executeCommand('session-1', '', {
      commandId: 'command-2', action: 'delete_session',
    })).resolves.toEqual({
      status: 'rejected',
      result: 'unsupported remote action: delete_session',
    })
  })
})
