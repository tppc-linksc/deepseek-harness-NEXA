/** Private renderer-to-main routes for desktop update operations. */

import type { DesktopUpdateState } from './update-contract.ts'

const updateRoutePrefix = '/_desktop/update/'
const preferenceBodyLimit = 1024
const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
}

/** Update-manager methods exposed to the private route adapter. */
export interface DesktopUpdateRouteManager {
  state(): DesktopUpdateState
  check(): Promise<void>
  startDownload(): void
  startUpdate(): void
  install(): Promise<void>
  setAutomaticChecks(enabled: boolean): Promise<void>
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: jsonHeaders })
}

function routeError(status: number, message: string): Response {
  return json({ error: message }, status)
}

async function automaticChecks(request: Request): Promise<boolean> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new Error('content type must be application/json')
  const announced = request.headers.get('content-length')
  if (announced !== null && (!/^\d+$/u.test(announced) || Number(announced) > preferenceBodyLimit)) {
    throw new Error('request body is too large')
  }
  const body = new Uint8Array(await request.arrayBuffer())
  if (body.byteLength > preferenceBodyLimit) throw new Error('request body is too large')
  const value: unknown = JSON.parse(new TextDecoder().decode(body))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('body must be an object')
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 1 || typeof record.automaticChecks !== 'boolean') {
    throw new Error('automaticChecks must be the only boolean field')
  }
  return record.automaticChecks
}

/**
 * Handle one renderer request without forwarding update privileges to the Host process.
 * @param request - custom-protocol renderer request.
 * @param url - parsed and authority-validated desktop URL.
 * @param manager - main-process update manager.
 * @returns a private-route response, or undefined for another desktop route.
 */
export async function handleDesktopUpdateRequest(
  request: Request,
  url: URL,
  manager: DesktopUpdateRouteManager,
): Promise<Response | undefined> {
  if (!url.pathname.startsWith(updateRoutePrefix)) return undefined
  if (url.search !== '' || url.hash !== '') return routeError(400, '更新请求地址无效。')
  const route = url.pathname.slice(updateRoutePrefix.length)
  try {
    if (route === 'state' && request.method === 'GET') return json(manager.state())
    if (route === 'check' && request.method === 'POST') {
      await manager.check()
      return json(manager.state())
    }
    if (route === 'download' && request.method === 'POST') {
      manager.startDownload()
      return json(manager.state(), 202)
    }
    if (route === 'apply' && request.method === 'POST') {
      manager.startUpdate()
      return json(manager.state(), 202)
    }
    if (route === 'install' && request.method === 'POST') {
      await manager.install()
      return json(manager.state())
    }
    if (route === 'preferences' && request.method === 'PUT') {
      await manager.setAutomaticChecks(await automaticChecks(request))
      return json(manager.state())
    }
    if (['state', 'check', 'download', 'apply', 'install', 'preferences'].includes(route)) {
      return routeError(405, '此更新操作不支持当前请求方法。')
    }
    return routeError(404, '更新操作不存在。')
  } catch {
    return routeError(409, manager.state().error ?? '更新操作暂时无法完成。')
  }
}
