/** Build one native DeepSeek Harness desktop installer from a deployed workspace closure. */

import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Arch, build, Platform, type Configuration } from 'electron-builder'
import sharp from 'sharp'

type DesktopTarget = 'linux' | 'mac' | 'win'
type DesktopArch = 'arm64' | 'x64'

const repositoryRoot = resolve(import.meta.dirname, '..')
const buildRoot = join(repositoryRoot, 'dist')
const output = join(buildRoot, 'installers')
const manifest = JSON.parse(readFileSync(join(repositoryRoot, 'apps', 'desktop', 'package.json'), 'utf8')) as {
  version: string
  devDependencies: { electron: string }
}

/** Read one required `--name value` argument. */
function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`--${name} requires a value`)
  return value
}

function defaultTarget(): DesktopTarget {
  switch (process.platform) {
    case 'darwin': return 'mac'
    case 'linux': return 'linux'
    case 'win32': return 'win'
    default: throw new Error(`desktop packaging does not support host ${process.platform}`)
  }
}

function parseTarget(value: string | undefined): DesktopTarget {
  const target = value ?? defaultTarget()
  if (target !== 'mac' && target !== 'win' && target !== 'linux') {
    throw new Error(`--target must be mac | win | linux, got ${JSON.stringify(target)}`)
  }
  return target
}

function parseArch(value: string | undefined): DesktopArch {
  const arch = value ?? process.arch
  if (arch !== 'arm64' && arch !== 'x64') {
    throw new Error(`--arch must be arm64 | x64, got ${JSON.stringify(arch)}`)
  }
  return arch
}

function assertTargetHost(target: DesktopTarget): void {
  if (target === 'mac' && process.platform !== 'darwin') {
    throw new Error('mac installers must be built on macOS')
  }
  if (target === 'linux' && process.platform !== 'linux') {
    throw new Error('Linux AppImages must be built on Linux; use the documented builder container')
  }
}

function assertFile(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`deployed ${label} is missing: ${path}`)
}

function validateNativePayload(staging: string, target: DesktopTarget, arch: DesktopArch): void {
  const modules = join(staging, 'node_modules')
  if (target === 'mac') {
    const prebuild = join(modules, 'node-pty', 'prebuilds', `darwin-${arch}`)
    const helper = join(prebuild, 'spawn-helper')
    assertFile(join(prebuild, 'pty.node'), `node-pty darwin-${arch} addon`)
    assertFile(helper, `node-pty darwin-${arch} spawn helper`)
    chmodSync(helper, 0o755)
  } else if (target === 'win') {
    assertFile(
      join(modules, 'node-pty', 'prebuilds', `win32-${arch}`, 'pty.node'),
      `node-pty win32-${arch} addon`,
    )
  } else {
    const candidates = [
      join(modules, 'node-pty', 'build', 'Release', 'pty.node'),
      join(modules, 'node-pty', 'prebuilds', `linux-${arch}`, 'pty.node'),
    ]
    if (!candidates.some(existsSync)) {
      throw new Error(`deployed node-pty linux-${arch} addon is missing: ${candidates.join(' or ')}`)
    }
  }
}

/** Remove the build machine's repository path from deployed text metadata and bundles. */
function sanitizeBuildPaths(staging: string): void {
  const extensions = new Set([
    '.css', '.html', '.js', '.json', '.map', '.md', '.mjs', '.txt', '.yaml', '.yml',
  ])
  const portableRepositoryRoot = repositoryRoot.replaceAll('\\', '/')
  const replacements: readonly [string, string][] = [
    [`file:///${portableRepositoryRoot}`, 'file:///workspace/deepseek-harness'],
    [repositoryRoot, '/workspace/deepseek-harness'],
    [portableRepositoryRoot, '/workspace/deepseek-harness'],
  ]
  const pending = [staging]
  while (pending.length > 0) {
    const directory = pending.pop()
    if (directory === undefined) break
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        pending.push(path)
        continue
      }
      if (!entry.isFile() || !extensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) continue
      const source = readFileSync(path, 'utf8')
      let sanitized = source
      for (const [buildPath, releasePath] of replacements) {
        sanitized = sanitized.replaceAll(buildPath, releasePath)
      }
      if (sanitized !== source) writeFileSync(path, sanitized)
    }
  }
}

/** Remove Electron template permissions and ATS exceptions unused by the portless app. */
function hardenMacInfoPlist(appOutDir: string): void {
  const infoPlist = join(appOutDir, 'DeepSeek Harness.app', 'Contents', 'Info.plist')
  for (const key of [
    'NSAppTransportSecurity',
    'NSAudioCaptureUsageDescription',
    'NSBluetoothAlwaysUsageDescription',
    'NSBluetoothPeripheralUsageDescription',
    'NSCameraUsageDescription',
    'NSMicrophoneUsageDescription',
  ]) {
    execFileSync('/usr/bin/plutil', ['-remove', key, infoPlist])
  }
}

async function createIcon(directory: string): Promise<string> {
  const favicon = readFileSync(join(repositoryRoot, 'apps', 'web', 'public', 'favicon.svg'), 'utf8')
  const open = favicon.indexOf('>')
  const close = favicon.lastIndexOf('</svg>')
  if (open === -1 || close === -1) throw new Error('Web favicon is not a complete SVG document')
  const mark = favicon.slice(open + 1, close)
    .replace(/<style>[\s\S]*?<\/style>/u, '')
    .replaceAll('fill="#000"', 'fill="#fff"')
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="64" y="64" width="896" height="896" rx="210" fill="#101216"/>
  <rect x="65" y="65" width="894" height="894" rx="209" fill="none" stroke="#303640" stroke-width="2"/>
  <g transform="translate(262 262) scale(10)">${mark}</g>
</svg>\n`
  const icon = join(directory, 'icon.png')
  await sharp(Buffer.from(source)).png().toFile(icon)
  return icon
}

function buildConfiguration(
  staging: string,
  icon: string,
  target: DesktopTarget,
  arch: DesktopArch,
): Configuration {
  const artifactName = `DeepSeek-NEXA-${manifest.version}-${target}-${arch}.\${ext}`
  return {
    appId: 'ai.deepseek.harness',
    productName: 'DeepSeek Harness',
    artifactName,
    electronVersion: manifest.devDependencies.electron,
    directories: { app: staging, output, buildResources: resolve(icon, '..') },
    files: ['**/*', '!**/*.d.ts', '!**/*.map', '!pnpm-workspace.yaml'],
    asar: true,
    asarUnpack: [
      '**/*.node',
      'node_modules/@img/**/*',
      'node_modules/node-pty/**/*',
      'node_modules/sharp/**/*',
    ],
    npmRebuild: false,
    publish: null,
    afterPack: (context) => {
      if (context.electronPlatformName === 'darwin') hardenMacInfoPlist(context.appOutDir)
    },
    mac: {
      icon,
      category: 'public.app-category.developer-tools',
      identity: '-',
      hardenedRuntime: false,
      gatekeeperAssess: false,
      strictVerify: true,
      notarize: false,
      minimumSystemVersion: '12.0',
    },
    dmg: {
      artifactName,
      title: 'DeepSeek Harness',
      contents: [
        { x: 140, y: 210, type: 'file' },
        { x: 400, y: 210, type: 'link', path: '/Applications' },
      ],
    },
    win: {
      icon,
      target: 'nsis',
      signExecutable: false,
      requestedExecutionLevel: 'asInvoker',
    },
    nsis: {
      artifactName,
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'DeepSeek Harness',
    },
    linux: {
      icon,
      target: 'AppImage',
      category: 'Development',
      executableName: 'deepseek-harness',
      synopsis: 'Unofficial desktop wrapper for DeepSeek Harness',
    },
    appImage: { artifactName },
  }
}

function targetMap(target: DesktopTarget, arch: DesktopArch): ReturnType<typeof Platform.MAC.createTarget> {
  const electronArch = arch === 'arm64' ? Arch.arm64 : Arch.x64
  if (target === 'mac') return Platform.MAC.createTarget('dmg', electronArch)
  if (target === 'win') return Platform.WINDOWS.createTarget('nsis', electronArch)
  return Platform.LINUX.createTarget('AppImage', electronArch)
}

const target = parseTarget(option('target'))
const arch = parseArch(option('arch'))
assertTargetHost(target)
mkdirSync(buildRoot, { recursive: true })
mkdirSync(output, { recursive: true })
const staging = mkdtempSync(join(buildRoot, `.desktop-staging-${target}-${arch}-`))
const iconWork = mkdtempSync(join(tmpdir(), 'dsh-desktop-icon-'))
const pnpmCli = process.env.npm_execpath
if (pnpmCli === undefined) throw new Error('package-desktop must run through the pnpm package script')

try {
  execFileSync(process.execPath, [pnpmCli,
    '--config.node-linker=hoisted',
    '--config.inject-workspace-packages=true',
    // The deployed absolute file URL cannot match the workspace-relative
    // allowBuilds key. The reviewed node-pty helper permission is restored by
    // validateNativePayload for macOS.
    '--config.strict-dep-builds=false',
    '--filter', '@deepseek-ai/dsh-desktop',
    'deploy', '--prod', staging,
  ], { cwd: repositoryRoot, stdio: 'inherit' })

  validateNativePayload(staging, target, arch)
  sanitizeBuildPaths(staging)
  const icon = await createIcon(iconWork)
  const artifacts = await build({
    targets: targetMap(target, arch),
    config: buildConfiguration(staging, icon, target, arch),
    projectDir: repositoryRoot,
  })
  for (const artifact of artifacts) console.log(`desktop installer: ${artifact}`)
} finally {
  rmSync(staging, { recursive: true, force: true })
  rmSync(iconWork, { recursive: true, force: true })
}
