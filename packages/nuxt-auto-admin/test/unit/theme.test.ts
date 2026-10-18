import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { themeCss } from '../../src/runtime/utils/themeCss'

describe('themeCss', () => {
  it('mixes the primary scale from one color, for the admin pages only', () => {
    const css = themeCss({ primaryColor: '#e11d48' })
    expect(css).toContain('html:has([data-auto-admin])')
    expect(css).toContain('--ui-color-primary-500: #e11d48;')
    expect(css).toContain('--ui-color-primary-50: color-mix(in oklch, #e11d48, white 92%);')
    expect(css).toContain('--ui-color-primary-950: color-mix(in oklch, #e11d48, black 70%);')
    expect(css).toContain('html.dark:has([data-auto-admin]) { --ui-primary: var(--ui-color-primary-400); }')
  })

  it('adds customCss as given, and nothing for an empty theme', () => {
    expect(themeCss({ customCss: '.admin-sidebar { width: 18rem }' })).toBe('.admin-sidebar { width: 18rem }')
    expect(themeCss(undefined)).toBe('')
  })

  it('ignores a color that would break out of the rule', () => {
    expect(themeCss({ primaryColor: 'red; } body { display: none' })).toBe('')
  })
})

// The class names custom CSS targets are part of the admin's API: renaming one breaks apps silently.
describe('stable class names', () => {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../src/runtime/${path}`, import.meta.url)), 'utf8')
  it.each([
    ['layouts/admin.vue', ['admin-layout', 'admin-main']],
    ['components/layout/AdminSidebar.vue', ['admin-sidebar']],
    ['components/layout/AdminHeader.vue', ['admin-header']],
    ['components/ResourceTable.vue', ['admin-table']],
    ['components/AutoForm.vue', ['admin-form']],
    ['components/AutoField.vue', ['admin-field']],
    ['components/ResourceFilters.vue', ['admin-filters']],
    ['pages/admin/index.vue', ['admin-page', 'admin-dashboard']],
    ['pages/admin/[resource]/index.vue', ['admin-page', 'admin-list']],
    ['pages/admin/[resource]/[id].vue', ['admin-page', 'admin-detail']],
    ['pages/admin/[resource]/new.vue', ['admin-page', 'admin-create']],
    ['pages/admin/[resource]/[id]/edit.vue', ['admin-page', 'admin-edit']],
  ])('%s', (file, classes) => {
    const source = read(file)
    for (const c of classes) expect(source).toMatch(new RegExp(`class="[^"]*\\b${c}\\b`))
  })
})
