import { describe, it, expect } from 'vitest'
import { inlinePluginSource, secretLikeOptions, serializeOption } from '../../src/utils/inlinePlugins'
import { createRateLimitPlugin, InMemoryRateLimitStore } from '../../src/runtime/plugins/rateLimitPlugin'
import { defineAutoApiPlugin } from '../../src/runtime/types/plugin'

// A plugin listed in nuxt.config reaches the server as generated code. A built-in factory is called again with
// its options — its runtimeSetup used to be stringified, losing every option it closed over (a rate limiter
// listed inline threw at startup, was logged, and did not limit anything).
describe('inline plugins', () => {
  it('a built-in factory is recreated from its options', () => {
    const plugin = createRateLimitPlugin({ max: 5, windowMs: 1000, skip: ctx => ctx.user?.role === 'admin' })
    const src = inlinePluginSource(plugin, 'f')
    expect(src.startsWith('f.createRateLimitPlugin({')).toBe(true)

    const recreated = new Function('f', `return ${src}`)({ createRateLimitPlugin: (opts: any) => opts })
    expect(recreated).toMatchObject({ max: 5, windowMs: 1000 })
    expect(recreated.skip({ user: { role: 'admin' } })).toBe(true)
  })

  it('writes data, functions and method shorthand as source', () => {
    const value = {
      a: [1, 'x', null],
      d: new Date(5),
      r: /a+/g,
      fn: (x: number) => x + 1,
      m(y: number) {
        return y * 2
      },
      nested: { undef: undefined },
    }
    const back = new Function(`return ${serializeOption(value, 'o')}`)()
    expect(back.a).toEqual([1, 'x', null])
    expect(back.d.getTime()).toBe(5)
    expect(back.r.test('aa')).toBe(true)
    expect(back.fn(1)).toBe(2)
    expect(back.m(2)).toBe(4)
  })

  it('an instance (a store, a Map) fails the build and points to the plugins file', () => {
    const plugin = createRateLimitPlugin({ store: new InMemoryRateLimitStore() })
    expect(() => inlinePluginSource(plugin, 'f')).toThrow(/option object\.store is a InMemoryRateLimitStore[\s\S]*autoapi-plugins/)
    expect(() => serializeOption({ m: new Map() }, 'o')).toThrow(/o\.m is a Map/)
  })

  it('a hand-written plugin keeps its runtimeSetup source', () => {
    const plugin = defineAutoApiPlugin({
      name: 'mine',
      runtimeSetup(ctx) {
        ctx.logger.info('hi')
      },
    })
    expect(inlinePluginSource(plugin, 'f')).toMatch(/^\{ name: "mine", runtimeSetup: function runtimeSetup\(ctx\) \{/)
  })

  it('flags options that look like secrets (they would be baked into the bundle)', () => {
    const plugin = { name: 'x', source: { factory: 'f', args: [{ signing: { secret: 's3cret' }, apiKey: 'k', max: 5, tokenLength: 32 }] } }
    expect(secretLikeOptions(plugin as any)).toEqual(['signing.secret', 'apiKey'])
  })
})
