import { lstatSync, rmSync, unlinkSync } from 'node:fs'
import { basename, relative, resolve } from 'node:path'

const runnerTemp = process.env.RUNNER_TEMP
const authDirectory = process.env.STATE_AUTH_DIRECTORY

if (runnerTemp && authDirectory) {
  const tempRoot = resolve(runnerTemp)
  const target = resolve(authDirectory)
  const fromTemp = relative(tempRoot, target)
  if (fromTemp && !fromTemp.startsWith('..') && !fromTemp.includes('/../') && basename(target).startsWith('nexa-remote-auth-')) {
    try {
      const stat = lstatSync(target)
      if (stat.isSymbolicLink()) unlinkSync(target)
      else if (stat.isDirectory()) rmSync(target, { recursive: true })
    }
    catch (error) {
      if (!isMissing(error)) throw error
    }
  }
  else {
    throw new Error(`Refusing to remove invalid NEXA Remote authentication directory: ${authDirectory}`)
  }
}

/**
 * Identify an already-removed action state directory.
 *
 * @param {unknown} error Filesystem failure.
 * @returns {boolean} Whether the path no longer exists.
 */
function isMissing(error) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
