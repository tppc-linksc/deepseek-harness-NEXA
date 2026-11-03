/**
 * dsh-desktop icon generator — render assets/icon.svg into build/icon.icns.
 *
 * sharp rasterizes the SVG at 1024px, macOS `sips` downsizes the standard
 * iconset grid, and `iconutil` assembles the .icns. Plain node; run with
 * `node scripts/make-icon.mjs` (prerequisite: the sharp devDependency).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const build = join(root, 'build')
const iconset = join(build, 'icon.iconset')

const svg = readFileSync(join(root, 'assets', 'icon.svg'))
const big = join(build, 'icon-1024.png')
mkdirSync(build, { recursive: true })
await sharp(svg).resize(1024, 1024).png().toFile(big)

// The standard macOS iconset grid (iconutil rejects other sizes).
const SIZES = [16, 32, 128, 256, 512]
rmSync(iconset, { recursive: true, force: true })
mkdirSync(iconset, { recursive: true })
for (const size of SIZES) {
  for (const scale of [1, 2]) {
    const px = size * scale
    const name = scale === 1 ? `icon_${size}x${size}.png` : `icon_${size}x${size}@2x.png`
    execFileSync('sips', ['-z', String(px), String(px), big, '--out', join(iconset, name)])
  }
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(build, 'icon.icns')])
console.log('build/icon.icns + build/icon-1024.png written')
