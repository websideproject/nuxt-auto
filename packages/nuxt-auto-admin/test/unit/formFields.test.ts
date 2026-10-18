import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { generateAdminRegistry } from '../../src/module'

const schemaPath = fileURLToPath(new URL('../fixtures/basic/server/database/schema.ts', import.meta.url))

/** The generated registry module, written out and imported — what the app loads at runtime. */
async function registryFor(config: Record<string, any>, apiHidden?: { global?: string[], resources?: Record<string, string[]> }) {
  const resource = { name: 'posts', schema: { __modulePath: schemaPath, __exportName: 'posts' } } as any
  const code = generateAdminRegistry([resource], { resources: { posts: config } } as any, apiHidden)
  const file = join(mkdtempSync(join(tmpdir(), 'admin-registry-')), 'registry.mjs')
  writeFileSync(file, code)
  return (await import(/* @vite-ignore */ file)).registry
}

const names = (fields: any[]) => fields.map(f => f.name)

describe('generated form fields', () => {
  it('leave out hidden fields — the resource\'s own and the API\'s — in create and edit', async () => {
    const registry = await registryFor({ hiddenFields: ['content'] }, { resources: { posts: ['published'] } })
    for (const mode of ['create', 'edit']) {
      expect(names(registry.posts.formFields[mode])).not.toContain('content')
      expect(names(registry.posts.formFields[mode])).not.toContain('published')
      expect(names(registry.posts.formFields[mode])).toContain('title')
    }
  })

  it('mark readonlyFields read-only in both modes', async () => {
    const registry = await registryFor({ readonlyFields: ['title'] })
    for (const mode of ['create', 'edit']) {
      expect(registry.posts.formFields[mode].find((f: any) => f.name === 'title').readonly).toBe(true)
      expect(registry.posts.formFields[mode].find((f: any) => f.name === 'content').readonly).toBe(false)
    }
  })
})

describe('configured form fields', () => {
  const title = { name: 'title', widget: 'TextInput' }
  const content = { name: 'content', widget: 'TextareaInput' }

  it('a mode left out gets the generated fields (edit falls back to create first)', async () => {
    const onlyEdit = await registryFor({ formFields: { edit: [title] } })
    expect(names(onlyEdit.posts.formFields.edit)).toEqual(['title'])
    expect(names(onlyEdit.posts.formFields.create)).toContain('content')

    const onlyCreate = await registryFor({ formFields: { create: [title, content] } })
    expect(names(onlyCreate.posts.formFields.edit)).toEqual(['title', 'content'])
  })

  it('readonlyFields apply to configured fields', async () => {
    const registry = await registryFor({ readonlyFields: ['title'], formFields: { create: [title, content] } })
    for (const mode of ['create', 'edit']) {
      expect(registry.posts.formFields[mode].map((f: any) => [f.name, !!f.readonly])).toEqual([['title', true], ['content', false]])
    }
  })
})
