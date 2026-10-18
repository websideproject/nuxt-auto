import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { findAppFile } from '../../src/module'
import { runFieldValidation, withFieldRules } from '../../src/runtime/utils/fieldRules'
import { defineAdminFields } from '../../src/runtime/composables/defineAdminFields'

const rules = defineAdminFields({
  articles: {
    publishedAt: { condition: form => !!form.published },
    slug: { validation: value => /^[a-z-]+$/.test(String(value ?? '')) || 'Lowercase letters and dashes' },
    title: { validation: async value => String(value).length > 2 },
  },
})

describe('admin.fields.ts rules', () => {
  it('attach condition and validation to the resource\'s fields only', () => {
    const fields = [{ name: 'title' }, { name: 'slug' }, { name: 'publishedAt' }, { name: 'content' }]
    const out = withFieldRules(fields, rules, 'articles')
    expect(out.map(f => [f.name, typeof f.condition, typeof f.validation])).toEqual([
      ['title', 'undefined', 'function'],
      ['slug', 'undefined', 'function'],
      ['publishedAt', 'function', 'undefined'],
      ['content', 'undefined', 'undefined'],
    ])
    expect(withFieldRules(fields, rules, 'posts')).toBe(fields)
    expect(out[2]!.condition!({ published: true })).toBe(true)
  })

  it('a validation result is a message, false, or acceptance', async () => {
    const [title, slug] = withFieldRules([{ name: 'title' }, { name: 'slug' }], rules, 'articles')
    expect(await runFieldValidation(slug!, 'Not OK', {})).toBe('Lowercase letters and dashes')
    expect(await runFieldValidation(slug!, 'fine-slug', {})).toBeUndefined()
    expect(await runFieldValidation(title!, 'ab', {})).toBe('Invalid value')
    expect(await runFieldValidation(title!, 'abc', {})).toBeUndefined()
    // A data `validation` from nuxt.config is not a function: nothing to run
    expect(await runFieldValidation({ name: 'x', validation: { min: 1 } }, '', {})).toBeUndefined()
  })

  it('finds admin.fields.ts in the source directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'admin-fields-'))
    expect(await findAppFile(undefined, dir, 'admin.fields', 'fields')).toBeNull()
    writeFileSync(join(dir, 'admin.fields.ts'), 'export default {}')
    expect(await findAppFile(undefined, dir, 'admin.fields', 'fields')).toBe(join(dir, 'admin.fields.ts'))
    await expect(findAppFile(join(dir, 'missing'), dir, 'admin.fields', 'fields')).rejects.toThrow(/autoAdmin\.fields: .* not found/)
  })
})
