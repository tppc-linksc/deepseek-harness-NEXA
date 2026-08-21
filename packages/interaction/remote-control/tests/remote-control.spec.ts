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
    await ctx.plugin(RemoteControlService, { enabled: false, statePath: path }).await()
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
