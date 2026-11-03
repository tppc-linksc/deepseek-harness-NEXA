/**
 * dsh-desktop host packager — assemble the self-contained host tree the
 * packaged app ships as `Resources/host` (extraResources).
 *
 * `pnpm deploy` materializes the dsh CLI's production dependency closure
 * (every built workspace package plus third-party deps) into host/, then a
 * self-contained node binary is placed at host/node — the packaged app spawns
 * `host/node host/node_modules/@deepseek-ai/dsh/lib/bin.js web` exactly like
 * dev mode spawns the repo CLI, so the harness code path is identical.
 * Requires a prior `pnpm run build:lib:host`.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readlinkSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, lstatSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, basename } from 'node:path'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const hostDir = join(appRoot, 'host')

const cliBin = join(repoRoot, 'apps', 'cli', 'lib', 'bin.js')
if (!existsSync(cliBin)) {
  throw new Error('dsh CLI is not built — run `pnpm run build:lib:host` before packing')
}

rmSync(hostDir, { recursive: true, force: true })
mkdirSync(hostDir, { recursive: true })
// --legacy: this workspace does not inject workspace packages; deploy copies them as-is.
// pnpm deploy --legacy has a known quirk: with a target inside the workspace
// it copies the populated target tree back into the vendored source packages
// (observed: vendor/schemastery gains apps/desktop/host). Remove that
// pollution immediately after deploy so translate materializes clean copies.
// CI=true: pnpm deploy would otherwise ask for TTY confirmation before
// purging a previous deploy's modules directory.
execFileSync('pnpm', ['deploy', '--legacy', '--filter', '@deepseek-ai/dsh', '--prod', hostDir], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: { ...process.env, CI: 'true' },
})
await removeDeployPollution()

await translateOutsideLinks() // see below

const nodeBin = await resolveNodeBinary()
copyFileSync(nodeBin, join(hostDir, 'node'))
await bootstrapHost() // see below
console.log(`host ready at ${hostDir} (node binary: ${statSync(join(hostDir, 'node')).size} bytes)`)

/**
 * Resolve the node runtime the packaged app ships as host/node.
 *
 * The bundled binary must be self-contained: copying a thin launcher (homebrew
 * node is a small executable loading libnode.dylib) breaks on other machines.
 * Candidate order: DSH_DESKTOP_NODE, the standalone /usr/local/bin/node, the
 * running node when it is standalone, then an official nodejs.org download
 * cached under build/. Universal binaries are thinned to the build arch with
 * lipo to keep the app smaller.
 */
async function resolveNodeBinary() {
  const candidates = [
    process.env.DSH_DESKTOP_NODE,
    '/usr/local/bin/node',
    process.execPath,
  ].filter((candidate) => candidate !== undefined && candidate !== '')
  for (const candidate of candidates) {
    if (await isStandalone(candidate)) return await thin(candidate)
  }
  return await downloadOfficialNode()
}

async function isStandalone(path) {
  try {
    if (statSync(path).size < 40 * 1024 * 1024) return false
  } catch {
    return false
  }
  const { spawnSync } = await import('node:child_process')
  return spawnSync(path, ['--version'], { timeout: 10_000 }).status === 0
}

async function thin(path) {
  const out = join(appRoot, 'build', 'node-thin')
  mkdirSync(dirname(out), { recursive: true })
  try {
    execFileSync('lipo', ['-thin', process.arch, path, '-output', out])
    return out
  } catch {
    copyFileSync(path, out)
    return out
  }
}

async function downloadOfficialNode() {
  const major = process.versions.node.split('.')[0]
  const index = await (await fetch('https://nodejs.org/dist/index.json')).json()
  const latest = index.find((entry) => entry.version.startsWith(`v${major}.`))
  if (latest === undefined) throw new Error(`package-host: no node v${major} release on nodejs.org`)
  const version = latest.version
  const dir = join(appRoot, 'build', `node-${version}`)
  const tarball = join(appRoot, 'build', `node-${version}-darwin-${process.arch}.tar.gz`)
  mkdirSync(dir, { recursive: true })
  const target = join(dir, 'bin', 'node')
  if (existsSync(target)) return target
  const url = `https://nodejs.org/dist/${version}/node-${version}-darwin-${process.arch}.tar.gz`
  console.log(`downloading ${url}`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`package-host: node download failed: HTTP ${response.status}`)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(tarball, Buffer.from(await response.arrayBuffer()))
  execFileSync('tar', ['-xzf', tarball, '-C', dir, '--strip-components=1'])
  return target
}

/**
 * Make the deployed tree self-contained.
 *
 * With linkWorkspacePackages:true, pnpm deploy leaves links whose text is
 * anchored at the repo root (or at the source package dir); they resolve on
 * the build machine but break once the tree moves into the .app. This pass
 * rewrites every link whose real target lies outside host/ to point at a
 * materialized copy inside the tree. Each outside target is copied at most
 * once (memoized by realpath) into .pnpm/<name>-<hash>, so the pass always
 * converges: a copied package's own outside links are resolved in the next
 * round, and nothing is ever copied twice. Links back to apps/cli point at
 * host/ itself — the deploy root IS the dsh package.
 */
async function translateOutsideLinks() {
  const pnpmDir = join(hostDir, 'node_modules', '.pnpm')
  const copies = new Map()
  const cliDir = join(repoRoot, 'apps', 'cli')
  for (let round = 0; round < 15; round++) {
    const links = []
    walkLinks(hostDir, (linkPath) => { links.push(linkPath) })
    let changed = 0
    for (const linkPath of links) {
      let target
      try {
        target = realpathSync(linkPath)
      } catch {
        // The link text resolved at its ORIGINAL repo location but not at the
        // copied one: re-anchor it at the repo to recover the intended target.
        const anchored = resolveBrokenTarget(readlinkSync(linkPath), basename(linkPath))
        if (anchored === undefined) continue
        target = anchored
      }
      if (target === hostDir || target.startsWith(hostDir + '/')) continue
      let mapped
      if (target === cliDir) {
        mapped = hostDir
      } else {
        mapped = copies.get(target)
        if (mapped === undefined) {
          // Plain basename: the vendored packages' own relative links
          // (../../../<dep> from .pnpm/<pkg>/node_modules/@deepseek-ai/) land
          // on .pnpm/<dep>, so materialized deps must sit exactly there.
          let entry = join(pnpmDir, basename(linkPath))
          const existing = realpathSyncSafe(entry)
          if (existing !== undefined && existing !== target) {
            // The plain name is taken by another package: fall back to a hashed
            // entry (only the vendored packages' own ../../../<dep> links need
            // the plain-name convention; rewritten links accept any location).
            entry = join(pnpmDir, basename(linkPath) + '-' + hashPath(target))
          }
          mapped = entry
          if (!existsSync(mapped)) {
            if (!existsSync(join(target, 'package.json'))) {
              throw new Error(`translateOutsideLinks: target is not a package dir: ${target} for ${linkPath}`)
            }
            mkdirSync(dirname(mapped), { recursive: true })
            execFileSync('ditto', [target, mapped])
            console.log(`  copied ${basename(linkPath)} <- ${target}`)
          }
          copies.set(target, mapped)
        }
      }
      rmSync(linkPath, { force: true })
      symlinkSync(relative(dirname(linkPath), mapped), linkPath)
      changed++
    }
    if (changed === 0) {
      console.log(`translated outside links; ${copies.size} packages materialized`)
      return
    }
    console.log(`translate round ${round + 1}: rewrote ${changed} links`)
  }
  throw new Error('translateOutsideLinks: did not converge after 15 rounds')
}

/**
 * Remove the trees pnpm deploy wrote back into the workspace: an 'apps'
 * directory (the deploy target's path prefix) inside workspace package roots,
 * and .pnpm entries whose names do not follow pnpm's standard
 * <name>@<version> / @scope+name@<version> pattern — the deploy's pollution
 * bug leaves unversioned broken copies there (observed: .pnpm/
 * cordis-plugin-loader lacking the Group export). translateOutsideLinks then
 * re-materializes clean copies.
 */
function removeDeployPollution() {
  for (const area of ['vendor', 'packages']) {
    const areaDir = join(repoRoot, area)
    if (!existsSync(areaDir)) continue
    for (const group of readdirSync(areaDir)) {
      const pkgDir = join(areaDir, group)
      if (!existsSync(join(pkgDir, 'package.json'))) continue
      const polluted = join(pkgDir, 'apps')
      if (existsSync(polluted)) {
        rmSync(polluted, { recursive: true, force: true })
        console.log(`removed deploy pollution: ${polluted}`)
      }
    }
  }
  const pnpmDir = join(hostDir, 'node_modules', '.pnpm')
  for (const entry of readdirSync(pnpmDir)) {
    const canonical = /^(@[^+]+\+)?[^/]+@/.test(entry)
    if (!canonical) {
      rmSync(join(pnpmDir, entry), { recursive: true, force: true })
      console.log(`removed unversioned .pnpm entry: ${entry}`)
    }
  }
}

/**
 * Resolve a link text that no longer resolves at its current location: strip
 * the leading parent hops and try the tail against the repo root, then the
 * vendor / packages / native areas (with a shallow group search).
 */
/**
 * Resolve a link text that no longer resolves at its current location.
 * The candidate package's manifest name must match the link's own name:
 * pnpm deploy rewrites dev-dep links of workspace packages to wrong targets
 * (observed: a cordis-plugin-loader link pointing at packages/typert/loader),
 * so a bare path hit is not enough.
 * @param text - the link text.
 * @param expectedName - the link's basename (the imported package's short name).
 */
function resolveBrokenTarget(text, expectedName) {
  const tail = text.replace(/^(?:\.\.\/)+/, '')
  const isPackage = (candidate) => {
    if (!existsSync(join(candidate, 'package.json'))) return false
    try {
      const meta = JSON.parse(readFileSync(join(candidate, 'package.json'), 'utf8'))
      return typeof meta.name === 'string' && meta.name.split('/').pop() === expectedName
    } catch {
      return false
    }
  }
  const candidates = []
  if (tail.includes('/')) {
    // Path-style texts are repo-root-relative or area-relative.
    for (const base of [repoRoot, join(repoRoot, 'vendor'), join(repoRoot, 'packages'), join(repoRoot, 'native')]) {
      candidates.push(join(base, tail))
    }
  } else {
    // Bare names only match real package dirs under a group (the area root
    // itself is a group dir, not a package).
    for (const area of ['vendor', 'packages', 'native']) {
      const areaDir = join(repoRoot, area)
      if (!existsSync(areaDir)) continue
      for (const group of readdirSync(areaDir)) {
        candidates.push(join(areaDir, group, tail))
      }
    }
  }
  // store-style texts (../../../@deepseek-ai+dsh-x@file+.../node_modules/...) are
  // anchored at the repo's virtual store, not the repo root.
  candidates.push(join(repoRoot, 'node_modules', '.pnpm', tail))
  // the landlock addons nest two levels under native/.
  candidates.push(join(repoRoot, 'native', 'landlock-run', 'packages', tail))
  return candidates.find(isPackage)
}

/** realpathSync that returns undefined instead of throwing. */
function realpathSyncSafe(path) {
  try {
    return realpathSync(path)
  } catch {
    return undefined
  }
}

/**
 * The deploy tree's links sometimes point at a workspace GROUP directory
 * (e.g. packages/settings instead of packages/settings/settings). Verify the
 * source actually IS the requested package; otherwise drill down one level.
 */
function materializeSource(target, name) {
  const metaPath = join(target, 'package.json')
  if (existsSync(metaPath)) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      if (meta.name === '@deepseek-ai/' + name || meta.name === name) return target
    } catch { /* unreadable manifest: keep drilling */ }
  }
  if (existsSync(target) && statSync(target).isDirectory()) {
    for (const sub of readdirSync(target)) {
      const candidate = join(target, sub)
      const subMeta = join(candidate, 'package.json')
      if (!existsSync(subMeta)) continue
      try {
        const meta = JSON.parse(readFileSync(subMeta, 'utf8'))
        if (meta.name === '@deepseek-ai/' + name || meta.name === name) return candidate
      } catch { /* skip */ }
    }
  }
  return target // give up; the ditto of the wrong dir is harmless to the boot probe
}

/** Stable short hash of an absolute path, for unique .pnpm entry names. */
function hashPath(target) {
  return createHash('sha1').update(target).digest('hex').slice(0, 8)
}

/** Depth-first walk calling visit for every symbolic link under root. */
function walkLinks(root, visit) {
  for (const entry of readdirSync(root)) {
    const p = join(root, entry)
    let stat
    try { stat = lstatSync(p) } catch { continue }
    if (stat.isSymbolicLink()) visit(p, readlinkSync(p))
    else if (stat.isDirectory()) walkLinks(p, visit)
  }
}

/**
 * Boot the assembled host once and materialize whatever pnpm deploy dropped:
 * peer dependencies of workspace packages are not installed into the deploy
 * tree (observed: @deepseek-ai/cordis-plugin-group, a peer of dsh-app-boot).
 * Each missing module aborts the boot with ERR_MODULE_NOT_FOUND, so spawning
 * the real host enumerates the gap exactly; the package is located in the
 * repo, copied into host/node_modules, links translated, and the boot retried.
 */
async function bootstrapHost() {
  const { spawn } = await import('node:child_process')
  const { createInterface } = await import('node:readline')
  const pkgIndex = indexRepoPackages()
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = await new Promise((resolve) => {
      const child = spawn(join(hostDir, 'node'), ['--expose-internals', join(hostDir, 'lib', 'bin.js'), 'web', '--port', '0'], {
        cwd: hostDir,
        // DSH_HOME inside the workspace: the boot is a build-time probe and the
        // host must not touch the operator's real home.
        // No telemetry opt-out: the boot must cover the exact production
        // configuration, or the packaged app would miss those plugins. The
        // probe home is discarded afterwards: a failed early boot writes the
        // tree back into the user layer (Loader tree write-back), which would
        // leak rows (e.g. a re-enabled hmr) into every later boot.
        env: { ...process.env, DSH_HOME: join(appRoot, '.bootstrap-home') },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let output = ''
      let settled = false
      const finish = (ok, message) => {
        if (settled) return
        settled = true
        child.kill('SIGKILL')
        resolve({ ok, message })
      }
      const lines = createInterface({ input: child.stdout })
      lines.on('line', (line) => {
        output += line + '\n'
        if (/^dsh web: http:\/\//.test(line)) finish(true, 'host ready')
      })
      child.stderr.on('data', (chunk) => { output += chunk.toString() })
      child.on('exit', (code) => {
        if (!settled) finish(code === 0, output)
        else resolve(result)
      })
      const timer = setTimeout(() => finish(true, 'host ready (timed out waiting)'), 30_000)
      child.on('exit', () => clearTimeout(timer))
    })
    if (result.ok) {
      console.log('bootstrap: host boots cleanly')
      rmSync(join(appRoot, '.bootstrap-home'), { recursive: true, force: true })
      return
    }
    const missing = [...result.message.matchAll(/Cannot find package '([^']+)'/g)].map((match) => match[1])
    if (missing.length === 0) {
      throw new Error(`bootstrapHost: host failed:\n${result.message.slice(0, 2000)}`)
    }
    let added = 0
    for (let raw of missing) {
      // Node reports path-style specifiers verbatim; extract the package name
      // from the last node_modules segment when the capture is a path.
      const fromPath = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(raw)
      if (fromPath !== null) raw = fromPath[1]
      const source = pkgIndex.get(raw)
      if (source === undefined) throw new Error(`bootstrapHost: cannot locate package ${raw} in the repo`)
      const dest = join(hostDir, 'node_modules', ...raw.split('/'))
      if (!existsSync(dest)) {
        mkdirSync(dirname(dest), { recursive: true })
        execFileSync('ditto', [source, dest])
        console.log(`bootstrap: materialized ${raw} <- ${source}`)
        added++
      }
    }
    if (added === 0) {
      throw new Error(`bootstrapHost: no progress for: ${missing.join(', ')}:\n${result.message.slice(0, 1200)}`)
    }
    await translateOutsideLinks() // the new copies may carry outside links
  }
  throw new Error('bootstrapHost: did not converge after 30 attempts')
}

/** Index repo package locations by package.json name (workspace + store). */
function indexRepoPackages() {
  const index = new Map()
  const add = (dir) => {
    const metaPath = join(dir, 'package.json')
    if (!existsSync(metaPath)) return
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      if (typeof meta.name === 'string' && !index.has(meta.name)) index.set(meta.name, dir)
    } catch { /* unreadable manifest: skip */ }
  }
  // workspace: vendor/*, packages/<group>/*, apps/*, native/landlock-run/packages/*
  for (const root of ['vendor', 'packages', 'apps', join('native', 'landlock-run', 'packages')]) {
    const areaDir = join(repoRoot, root)
    if (!existsSync(areaDir)) continue
    for (const group of readdirSync(areaDir)) {
      const groupDir = join(areaDir, group)
      if (!statSync(groupDir).isDirectory()) continue
      add(groupDir)
      if (existsSync(join(groupDir, 'package.json'))) continue
      for (const pkg of readdirSync(groupDir)) add(join(groupDir, pkg))
    }
  }
  // store: node_modules/.pnpm/<entry>/node_modules/<name> and .../@scope/<name>
  const pnpmDir = join(repoRoot, 'node_modules', '.pnpm')
  for (const entry of readdirSync(pnpmDir)) {
    const nm = join(pnpmDir, entry, 'node_modules')
    if (!existsSync(nm)) continue
    for (const scopeDir of readdirSync(nm)) {
      const pkgDir = join(nm, scopeDir)
      add(pkgDir)
      if (existsSync(join(pkgDir, 'package.json'))) continue
      for (const sub of readdirSync(pkgDir)) add(join(pkgDir, sub))
    }
  }
  return index
}