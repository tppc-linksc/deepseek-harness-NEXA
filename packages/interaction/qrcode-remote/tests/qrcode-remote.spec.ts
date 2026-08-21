import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
              sessionId: 'subagent-1', cwd: '/work/NEXA-Remote', updatedAt: 90,
              running: false, blank: false, origin: 'subagent',
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
            sessionIds: ['session-1'], createdAt: '2026-08-22T00:00:00Z', updatedAt: '2026-08-22T00:00:00Z',
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
      workspaces: [{ workspaceId: 'workspace-1', name: 'NEXA-Remote' }],
      sessions: [{
        sessionId: 'session-1', workspaceId: 'workspace-1', title: '同步移动端历史',
        cursor: 8, running: true, blank: false,
      }],
    })
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
