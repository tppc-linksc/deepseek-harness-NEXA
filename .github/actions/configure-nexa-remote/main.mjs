import { appendFileSync, chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const githubEd25519HostKey = 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n'
const deployKey = process.env.INPUT_DEPLOY_KEY?.replaceAll('\r', '').trimEnd()
const runnerTemp = process.env.RUNNER_TEMP
const githubEnv = process.env.GITHUB_ENV
const githubState = process.env.GITHUB_STATE

if (!deployKey) fail('Repository secret NEXA_REMOTE_DEPLOY_KEY is required to install the private NEXA-Remote dependency.')
if (!runnerTemp) fail('GitHub Actions did not provide RUNNER_TEMP.')
if (!githubEnv) fail('GitHub Actions did not provide GITHUB_ENV.')
if (!githubState) fail('GitHub Actions did not provide GITHUB_STATE.')

const authDirectory = mkdtempSync(join(runnerTemp, 'nexa-remote-auth-'))
const keyPath = join(authDirectory, 'deploy-key')
const knownHostsPath = join(authDirectory, 'known-hosts')
const configPath = join(authDirectory, 'ssh-config')

appendFileSync(githubState, `AUTH_DIRECTORY=${authDirectory}\n`, 'utf8')
writeFileSync(keyPath, `${deployKey}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
writeFileSync(knownHostsPath, githubEd25519HostKey, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
writeFileSync(configPath, [
  'Host github.com',
  '  HostName github.com',
  '  User git',
  `  IdentityFile ${quoteSshConfigValue(keyPath)}`,
  '  IdentitiesOnly yes',
  `  UserKnownHostsFile ${quoteSshConfigValue(knownHostsPath)}`,
  '  StrictHostKeyChecking yes',
  '',
].join('\n'), { encoding: 'utf8', flag: 'wx', mode: 0o600 })
chmodSync(authDirectory, 0o700)

appendFileSync(githubEnv, `GIT_SSH_COMMAND=ssh -F ${quoteCommandArgument(configPath)}\n`, 'utf8')

/**
 * Quote one OpenSSH configuration value without relying on the runner shell.
 *
 * @param {string} value Absolute path written by this action.
 * @returns {string} Double-quoted OpenSSH configuration value.
 */
function quoteSshConfigValue(value) {
  return `"${normalizePath(value).replaceAll('"', '\\"')}"`
}

/**
 * Quote one argument in the command string Git passes through its shell.
 *
 * @param {string} value Absolute path written by this action.
 * @returns {string} Single-quoted shell argument.
 */
function quoteCommandArgument(value) {
  return `'${normalizePath(value).replaceAll("'", "'\\''")}'`
}

/**
 * Normalize Windows paths for Git for Windows' POSIX-compatible command parser.
 *
 * @param {string} value Filesystem path.
 * @returns {string} Path accepted by native OpenSSH and Git for Windows.
 */
function normalizePath(value) {
  return value.replaceAll('\\', '/')
}

/**
 * Emit one actionable GitHub annotation and terminate the action.
 *
 * @param {string} message Failure and correction.
 * @returns {never} This function always throws.
 */
function fail(message) {
  console.error(`::error title=NEXA Remote authentication::${message}`)
  throw new Error(message)
}
