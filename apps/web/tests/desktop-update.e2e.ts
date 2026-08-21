// Assembled browser coverage for the desktop update notification. Electron's
// private main-process route is the only mocked boundary; the Loader, built
// client plugin, shell overlay, locale, renderer, and CSS are the shipped path.
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page, Route } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  assertFixtureInventory,
  captureStableAria,
  compareOrRefreshGolden,
  launchWebScaffold,
  watchConsole,
  webSnapshotMode,
  type WebScaffold,
} from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const OVERLAY = fileURLToPath(new URL('./desktop-update.overlay.yml', import.meta.url))
const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/desktop-update', import.meta.url))
const AVAILABLE_EXPECTED = join(SNAPSHOT_DIR, 'available.expected.md')
const DOWNLOADED_EXPECTED = join(SNAPSHOT_DIR, 'downloaded.expected.md')
const MODE = webSnapshotMode()

interface UpdateState {
  phase: 'available' | 'downloaded' | 'downloading' | 'installing'
  currentVersion: string
  automaticChecks: boolean
  installer: 'dmg'
  availableVersion: string
  downloadedBytes: number
  totalBytes: number
}

describe('web e2e: desktop update notification', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>
  let state: UpdateState
  let downloadRequests = 0
  let installRequests = 0
  let downloadPolls = 0

  async function updateRoute(route: Route): Promise<void> {
    const request = route.request()
    const name = new URL(request.url()).pathname.split('/').at(-1)
    if (name === 'state' && request.method() === 'GET') {
      if (state.phase === 'downloading') {
        downloadPolls += 1
        if (downloadPolls >= 2) {
          state = { ...state, phase: 'downloaded', downloadedBytes: state.totalBytes }
        }
      }
    } else if (name === 'download' && request.method() === 'POST') {
      downloadRequests += 1
      state = { ...state, phase: 'downloading', downloadedBytes: 64 }
    } else if (name === 'install' && request.method() === 'POST') {
      installRequests += 1
      state = { ...state, phase: 'installing' }
    } else {
      await route.fulfill({ status: 405, contentType: 'application/json', body: '{"error":"unexpected route"}' })
      return
    }
    await route.fulfill({
      status: state.phase === 'downloading' || state.phase === 'installing' ? 202 : 200,
      contentType: 'application/json',
      body: JSON.stringify(state),
    })
  }

  beforeAll(async () => {
    state = {
      phase: 'available',
      currentVersion: '0.1.0-rc.7',
      automaticChecks: true,
      installer: 'dmg',
      availableVersion: '0.1.0-rc.8',
      downloadedBytes: 0,
      totalBytes: 256,
    }
    scaffold = await launchWebScaffold({ extraOverlayPath: OVERLAY })
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.route('**/_desktop/update/**', updateRoute)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    await page.getByText('New version available', { exact: true }).waitFor({ timeout: 10_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('downloads without a modal, restores a completion action, and begins the explicit DMG handoff', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-desktop-update'))

    expect(await page.getByRole('dialog').count()).toBe(0)
    const available = await captureStableAria(page, '[data-desktop-update-notice]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(AVAILABLE_EXPECTED, available, MODE)

    await page.getByRole('button', { name: 'Download update' }).click()
    await expect.poll(() => downloadRequests, { timeout: 5_000 }).toBe(1)
    await page.getByText('Download complete', { exact: true }).waitFor({ timeout: 10_000 })
    const downloaded = await captureStableAria(page, '[data-desktop-update-notice]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(DOWNLOADED_EXPECTED, downloaded, MODE)

    await page.getByRole('button', { name: 'Quit and open DMG' }).click()
    await expect.poll(() => installRequests, { timeout: 5_000 }).toBe(1)
    await page.getByText('Preparing update', { exact: true }).waitFor({ timeout: 5_000 })
    expect(tripwire.pageErrors).toEqual([])
  }, 30_000)

  it('keeps its snapshot inventory closed', async () => {
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, [
      'available.expected.md',
      'downloaded.expected.md',
    ])
  })
})
