/**
 * dsh-desktop app finisher — inject the host tree into the packed .app and
 * (optionally) assemble the dmg.
 *
 * electron-builder excludes every node_modules path from its file matchers,
 * so the host cannot ride extraResources. This script copies the assembled
 * host/ tree into <app>/Contents/Resources/host PRESERVING symlinks: pnpm's
 * deployed node_modules is a relative-symlink farm into node_modules/.pnpm,
 * and the whole tree moves together, so every link stays valid in the app.
 * (Dereferencing instead would re-materialize the reachable closure under
 * every package and blow the path length; fs.cp also chokes on the nested
 * symlinked dirs, so this uses macOS ditto.) An optional --dmg builds the
 * disk image with hdiutil. No harness code runs here.
 */
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const hostDir = join(appRoot, 'host')
const appBundle = join(appRoot, 'dist', 'mac-arm64', 'DeepSeek Harness.app')
const resourcesHost = join(appBundle, 'Contents', 'Resources', 'host')

if (!existsSync(hostDir)) throw new Error('host tree missing — run `node scripts/package-host.mjs` first')
if (!existsSync(appBundle)) throw new Error(`app bundle missing at ${appBundle} — run electron-builder --dir first`)

execFileSync('ditto', [hostDir, resourcesHost])
console.log(`host injected at ${resourcesHost}`)

if (process.argv.includes('--dmg')) {
  const { version } = JSON.parse(await (await import('node:fs/promises')).readFile(join(appRoot, 'package.json'), 'utf8'))
  const out = join(appRoot, 'dist', `dsh-desktop-${version}-arm64.dmg`)
  execFileSync('hdiutil', [
    'create', '-volname', 'DeepSeek Harness', '-srcfolder', appBundle,
    '-ov', '-format', 'UDZO', '-fs', 'HFS+', out,
  ], { stdio: 'inherit' })
  console.log(`dmg written at ${out}`)
}