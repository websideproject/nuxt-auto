import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { createFileUploadPlugin } from '../../../src/runtime/plugins/fileUploadPlugin'

function blobModule(storage: 'local' | 'nuxthub-blob') {
  const hooks: Record<string, (config: any) => void> = {}
  const ctx: any = {
    options: { prefix: '/api' },
    nuxt: { options: { runtimeConfig: {} }, hook: (name: string, fn: any) => { hooks[name] = fn } },
    resolver: { resolve: (p: string) => p },
    addServerHandler: () => {},
  }
  createFileUploadPlugin({ storage, resources: { posts: { field: 'cover' } } }).buildSetup!(ctx)
  const nitroConfig: any = {}
  hooks['nitro:config']!(nitroConfig)
  return nitroConfig.virtual['#nuxt-auto-api-blob']
}

describe('createFileUploadPlugin', () => {
  it('imports NuxtHub blob storage only when it is the storage', () => {
    expect(blobModule('nuxthub-blob')).toContain('hub:blob')
    expect(blobModule('local')).not.toContain('hub:blob')
  })

  // `import('#imports')` from a module file inlines Nitro's whole auto-import module, whose free references
  // (H3Error, …) break every route at startup.
  it('no runtime file imports #imports', () => {
    const root = fileURLToPath(new URL('../../../src/runtime', import.meta.url))
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = join(dir, name)
        if (statSync(file).isDirectory()) walk(file)
        else if (/\.(?:ts|vue)$/.test(name) && /['"]#imports['"]/.test(readFileSync(file, 'utf8'))) offenders.push(file.slice(root.length))
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })
})
