import { afterEach, describe, expect, it, vi } from 'vitest'
import { executeAfterHook, executeBeforeHook } from '../../../src/runtime/server/utils/executeHooks'
import { setNitroApp } from '../../../src/runtime/server/plugins/pluginRegistry'

/** A hook that throws. */
const fails = (error: Error | string) => () => {
  throw typeof error === 'string' ? new Error(error) : error
}

function contextWith(hooks: Record<string, (...args: any[]) => any>, hookConfig: Record<string, unknown> = {}) {
  return {
    resource: 'posts',
    params: { id: '7' },
    runtimeConfig: { autoApi: { hookConfig } },
    resourceConfig: { hooks },
  } as any
}

describe('autoApi:hook-error', () => {
  afterEach(() => {
    setNitroApp(undefined)
    vi.restoreAllMocks()
  })

  it('tells the Nitro hook about an after-hook error the request survives', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const callHook = vi.fn(async () => {})
    setNitroApp({ hooks: { callHook } })
    const boom = new Error('mail is down')
    await executeAfterHook('create', contextWith({ afterCreate: fails(boom) }), { id: '7' })
    expect(callHook).toHaveBeenCalledTimes(1)
    expect(callHook.mock.calls[0]![0]).toBe('autoApi:hook-error')
    expect(callHook.mock.calls[0]![1]).toMatchObject({ resource: 'posts', hook: 'afterCreate', id: '7', error: boom, timedOut: false })
  })

  it('marks a hook that passed the timeout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const callHook = vi.fn(async () => {})
    setNitroApp({ hooks: { callHook } })
    await executeAfterHook('update', contextWith({ afterUpdate: () => new Promise(() => {}) }, { timeout: 10 }), { id: '7' })
    expect(callHook.mock.calls[0]![1]).toMatchObject({ hook: 'afterUpdate', timedOut: true })
  })

  it('says nothing when the error fails the request', async () => {
    const callHook = vi.fn(async () => {})
    setNitroApp({ hooks: { callHook } })
    const ctx = contextWith({ afterCreate: fails('x'), beforeCreate: fails('y') }, { errorHandling: 'throw' })
    await expect(executeAfterHook('create', ctx, {})).rejects.toThrow('x')
    await expect(executeBeforeHook('create', ctx, {})).rejects.toThrow('y')
    expect(callHook).not.toHaveBeenCalled()
  })

  it('survives a listener that throws, and no Nitro app at all', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    setNitroApp({ hooks: { callHook: async () => fails('listener')() } })
    await executeAfterHook('create', contextWith({ afterCreate: fails('x') }), {})
    await new Promise(r => setTimeout(r, 0))
    expect(logged.mock.calls.some(c => String(c[0]).includes('listener failed'))).toBe(true)
    setNitroApp(undefined)
    await expect(executeAfterHook('create', contextWith({ afterCreate: fails('x') }), {})).resolves.toBeUndefined()
  })
})
