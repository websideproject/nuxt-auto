import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { loadNuxt } from '@nuxt/kit'
import { PUBLIC_SERVER_UTILS } from '../src/runtime/server/publicServerUtils'

// Module wiring that only a real Nuxt instance exercises.
describe('module setup', () => {
  it('registers every server auto-import from a file that exists', async () => {
    // An extensionless `…/utils.public` was read by the server import pipeline as `…/utils` (a directory):
    // fine on presets that allow externals, a hard build failure on Cloudflare. Check the exact paths.
    const nuxt = await loadNuxt({
      cwd: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
      ready: true,
      overrides: { _prepare: true } as any,
    })
    try {
      // Run each `nitro:config` hook on a skeleton config; other modules' hooks may expect more of the real
      // config than this test builds, and only the auto-api registrations matter here.
      const nitroConfig: any = { alias: {}, imports: { imports: [] }, virtual: {}, externals: { inline: [] }, plugins: [], handlers: [] }
      for (const hook of (nuxt.hooks as any)._hooks['nitro:config'] ?? []) {
        try {
          await hook(nitroConfig)
        }
        catch {
          // not ours
        }
      }
      const registered = (nitroConfig.imports?.imports ?? []).filter((i: any) => (PUBLIC_SERVER_UTILS as readonly string[]).includes(i.name))
      expect(registered.map((i: any) => i.name).sort()).toEqual([...PUBLIC_SERVER_UTILS].sort())
      for (const i of registered) expect(existsSync(i.from), `${i.name} ← ${i.from}`).toBe(true)
    }
    finally {
      await nuxt.close()
    }
  }, 120_000)

  it('bundles the generated registry and plugins modules and the plugin files, so dev rebuilds on their edits', async () => {
    // Nitro keeps the build dir external in dev; left there, Node loads these modules — and the resource and plugin
    // files they import — outside the bundle, where Nitro's watcher never sees an edit.
    const nuxt = await loadNuxt({
      cwd: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
      ready: true,
      overrides: { _prepare: true, autoApi: { plugins: '~/server/autoapi-plugins' } } as any,
    })
    try {
      const nitroConfig: any = { alias: {}, imports: { imports: [] }, virtual: {}, externals: { inline: [] }, plugins: [], handlers: [] }
      for (const hook of (nuxt.hooks as any)._hooks['nitro:config'] ?? []) {
        try {
          await hook(nitroConfig)
        }
        catch {
          // not ours
        }
      }
      expect(nitroConfig.externals.inline).toEqual(expect.arrayContaining([
        join(nuxt.options.buildDir, 'nuxt-auto-api-registry.mjs'),
        join(nuxt.options.buildDir, 'nuxt-auto-api-plugins.mjs'),
        join(nuxt.options.rootDir, 'server/autoapi-plugins'),
      ]))
    }
    finally {
      await nuxt.close()
    }
  }, 120_000)

  it('fails the build on a removed option instead of ignoring it', async () => {
    await expect(loadNuxt({
      cwd: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
      ready: true,
      overrides: { _prepare: true, autoApi: { extensions: [] } } as any,
    })).rejects.toThrow(/autoApi\.extensions was removed: list the plugins in autoApi\.plugins/)
  }, 120_000)
})
