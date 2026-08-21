/** Desktop update layout rules that prevent the settings section from widening its modal. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/DesktopUpdateRow.module.css', import.meta.url)), 'utf8')
const noticeCss = readFileSync(fileURLToPath(new URL('../src/client/DesktopUpdateNotice.module.css', import.meta.url)), 'utf8')

/** Return the declarations for one top-level class rule. */
function block(selector: string): string {
  const match = new RegExp(`^\\${selector} \\{([^}]*)\\}`, 'm').exec(css)
  if (match === null) throw new Error(`DesktopUpdateRow.module.css has no \`${selector}\` rule`)
  return match[1] ?? ''
}

describe('DesktopUpdateRow layout styles', () => {
  it('contains padding inside the available settings width', () => {
    expect(block('.group')).toContain('width: 100%')
    expect(block('.group')).toContain('max-width: 720px')
    expect(block('.group')).toContain('min-width: 0')
    expect(block('.group')).toContain('box-sizing: border-box')
  })

  it('renders automatic checks as a theme-aware switch', () => {
    expect(block('.switch')).toContain('border-radius: 10px')
    expect(css).toContain(".switch[aria-checked='true'] {\n  background: var(--dsw-alias-brand-primary)")
    expect(block('.switchThumb')).toContain('background: var(--dsw-alias-bg-layer-1)')
  })
})

describe('DesktopUpdateNotice layout styles', () => {
  it('anchors an interactive bounded card to the lower-left shell corner', () => {
    expect(noticeCss).toContain('position: absolute')
    expect(noticeCss).toContain('left: 20px')
    expect(noticeCss).toContain('bottom: 20px')
    expect(noticeCss).toContain('width: min(360px, calc(100% - 40px))')
  })
})
