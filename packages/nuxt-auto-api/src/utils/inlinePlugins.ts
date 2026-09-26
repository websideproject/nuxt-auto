import type { AutoApiPlugin } from '../runtime/types/plugin'

const isPlainObject = (v: object) => [Object.prototype, null].includes(Object.getPrototypeOf(v))

function functionSource(fn: (...args: any[]) => any): string {
  const src = fn.toString()
  // Method shorthand (`skip(ctx) { … }`) is not an expression on its own.
  if (/^(?:async\s+)?(?!function\b)[\w$]+\s*\(/.test(src)) return src.replace(/^(async\s+)?/, '$1function ')
  return src
}

/**
 * JavaScript source for a factory argument. Data is written as literals and functions as their source — a
 * function that uses a variable from nuxt.config will not find it on the server, so keep them self-contained.
 * Anything else (a class instance such as a KV store, a Map) cannot be recreated and fails the build.
 */
export function serializeOption(value: unknown, where: string): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'function') return `(${functionSource(value as any)})`
  if (value instanceof RegExp) return value.toString()
  if (value instanceof Date) return `new Date(${value.getTime()})`
  if (Array.isArray(value)) return `[${value.map((v, i) => serializeOption(v, `${where}[${i}]`)).join(', ')}]`
  if (typeof value === 'object' && isPlainObject(value)) {
    return `{ ${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${serializeOption(v, `${where}.${k}`)}`).join(', ')} }`
  }
  const kind = (value as object)?.constructor?.name || typeof value
  throw new Error(`[nuxt-auto-api] ${where} is a ${kind}, which cannot be passed from nuxt.config to the server. Register the plugin from a file instead: autoApi: { plugins: '~/server/autoapi-plugins' } (a file that default-exports the plugin array).`)
}

/**
 * Server-side source for a plugin listed inline in nuxt.config. A built-in factory's plugin is recreated by
 * calling the factory (`factories.createRateLimitPlugin({ … })`), so its runtime code keeps its options; a
 * hand-written plugin's `runtimeSetup` is inlined as source and must not use variables from nuxt.config.
 */
export function inlinePluginSource(plugin: AutoApiPlugin, factories: string): string {
  if (plugin.source) {
    const args = plugin.source.args.map((arg, i) => serializeOption(arg, `plugin "${plugin.name}" option ${i === 0 ? 'object' : `#${i + 1}`}`))
    return `${factories}.${plugin.source.factory}(${args.join(', ')})`
  }
  return `{ name: ${JSON.stringify(plugin.name)}, runtimeSetup: ${functionSource(plugin.runtimeSetup ?? (() => {}))} }`
}

/**
 * Option paths of an inline plugin that look like secrets. Options listed in nuxt.config are written into the
 * server bundle as literals, so a `process.env.SECRET` read there is baked into the build output.
 */
export function secretLikeOptions(plugin: AutoApiPlugin): string[] {
  const found: string[] = []
  const walk = (value: unknown, path: string) => {
    if (!value || typeof value !== 'object') return
    for (const [key, v] of Object.entries(value)) {
      const here = path ? `${path}.${key}` : key
      if (typeof v === 'string' && v && /secret|password|passphrase|api_?key|token|private/i.test(key)) found.push(here)
      else walk(v, here)
    }
  }
  for (const arg of plugin.source?.args ?? []) walk(arg, '')
  return found
}
