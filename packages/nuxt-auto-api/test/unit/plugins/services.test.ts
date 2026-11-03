import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getNitroApp, hasService, provideService, removeService, setNitroApp, useService } from '../../../src/runtime/server/plugins/pluginRegistry'
import initPlugins from '../../../src/runtime/server/plugins/initPlugins'

declare module '../../../src/runtime/types/plugin' {
  interface AutoApiServices {
    'test.greet': (name: string) => string
  }
}

describe('services', () => {
  beforeEach(() => {
    globalThis.__autoApiPluginRegistry = undefined
  })
  afterEach(() => vi.restoreAllMocks())

  it('a service one side provides, the other uses, typed by AutoApiServices', () => {
    provideService('test.greet', name => `hi ${name}`)
    const greet = useService('test.greet')
    expect(greet?.('Mia')).toBe('hi Mia')
    expect(hasService('test.greet')).toBe(true)
  })

  it('providing a name again replaces it; removing it leaves nothing', () => {
    provideService('test.greet', () => 'one')
    provideService('test.greet', () => 'two')
    expect(useService('test.greet')?.('x')).toBe('two')
    removeService('test.greet')
    expect(hasService('test.greet')).toBe(false)
  })

  it('a missing service warns once per name, and never when optional', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(useService('audit.log')).toBeUndefined()
    expect(useService('audit.log')).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toMatch(/Nothing provides the service "audit.log"/)
    expect(useService('events.emit', { optional: true })).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('survives a registry made by an older copy, which has no services yet', () => {
    globalThis.__autoApiPluginRegistry = { middleware: [], contextExtenders: [], globalHooks: [], resourceHooks: {}, permissionEvaluators: [], protectedFields: {}, initialized: false } as any
    expect(useService('test.greet', { optional: true })).toBeUndefined()
    provideService('test.greet', () => 'ok')
    expect(useService('test.greet')?.('x')).toBe('ok')
  })

  it('the module\'s Nitro plugin keeps the Nitro app for code outside the bundle', async () => {
    expect(getNitroApp()).toBeUndefined()
    const nitroApp = { hooks: { callHook: vi.fn() } }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await (initPlugins as any)(nitroApp)
    expect(getNitroApp()).toBe(nitroApp)
    setNitroApp(undefined)
  })
})
