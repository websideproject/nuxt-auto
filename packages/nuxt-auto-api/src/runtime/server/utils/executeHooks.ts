import { useRuntimeConfig } from 'nitropack/runtime'
import type { HandlerContext, ResourceHooks } from '../../types'
import { getPluginHooks } from '../plugins/pluginRegistry'

/**
 * Wraps an error thrown by an after-hook when `hookConfig.errorHandling` is `'log'` (the default for
 * after-hooks) — it is logged, not thrown. Before-hooks always re-throw the hook's OWN error, so a hook
 * that throws `createError({ statusCode: 409 })` produces a 409.
 */
export class HookExecutionError extends Error {
  constructor(message: string, public hookName: string, public override cause?: Error) {
    super(message)
    this.name = 'HookExecutionError'
  }
}

/**
 * Hooks for a resource, lowest priority first:
 *  1. legacy `globalThis.__autoApiHooks`
 *  2. plugin hooks (`addResourceHook` / `addGlobalHook`)
 *  3. the resource registration's `hooks` (via `createModuleImport`)
 */
function getAllHooks(context: HandlerContext, hookName: keyof ResourceHooks): Array<(...args: any[]) => any> {
  const hooks: Array<(...args: any[]) => any> = []
  const legacy = (globalThis as any).__autoApiHooks?.[context.resource]?.[hookName]
  if (typeof legacy === 'function') hooks.push(legacy)
  hooks.push(...getPluginHooks(context.resource, hookName) as any[])
  const registered = context.resourceConfig?.hooks?.[hookName]
  if (typeof registered === 'function') hooks.push(registered as any)
  return hooks
}

function hookConfig(context: HandlerContext) {
  const cfg = ((context.runtimeConfig as any) ?? useRuntimeConfig?.())?.autoApi?.hookConfig ?? {}
  return {
    timeout: cfg.timeout || 5000,
    parallel: !!cfg.parallel,
    errorHandling: cfg.errorHandling as 'throw' | 'log' | undefined,
  }
}

async function runWithTimeout(hook: (...args: any[]) => any, args: any[], hookName: string, timeout: number): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(() => hook(...args)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Hook ${hookName} timed out after ${timeout}ms`)), timeout)
      }),
    ])
  }
  finally {
    if (timer) clearTimeout(timer)
  }
}

type Op = 'create' | 'update' | 'delete' | 'list' | 'get'

function hookArgs(operation: Op, context: HandlerContext, data: any, id: any): any[] {
  switch (operation) {
    case 'update': return [id, data, context]
    case 'get':
    case 'delete': return [id, context]
    case 'list': return [context]
    default: return [data, context]
  }
}

/**
 * Run `before*` hooks. A hook may return a replacement for `data` (create/update). Errors are re-thrown
 * as-is (blocking the operation) unless `hookConfig.errorHandling` is `'log'`.
 */
export async function executeBeforeHook(operation: Op, context: HandlerContext, data?: any, id?: string | number): Promise<any> {
  const hookName = `before${operation[0]!.toUpperCase()}${operation.slice(1)}` as keyof ResourceHooks
  const hooks = getAllHooks(context, hookName)
  if (hooks.length === 0) return data

  const { timeout, parallel, errorHandling } = hookConfig(context)
  let current = data
  try {
    if (parallel && hooks.length > 1) {
      const results = await Promise.all(hooks.map(h => runWithTimeout(h, hookArgs(operation, context, current, id), hookName, timeout)))
      for (const r of results.reverse()) {
        if (r !== undefined) {
          current = r
          break
        }
      }
    }
    else {
      for (const hook of hooks) {
        const r = await runWithTimeout(hook, hookArgs(operation, context, current, id), hookName, timeout)
        if (r !== undefined && (operation === 'create' || operation === 'update')) current = r
      }
    }
  }
  catch (error) {
    if (errorHandling === 'log') console.error(`[nuxt-auto-api] ${hookName} hook failed:`, error)
    else throw error
  }
  return current
}

/** Run `after*` hooks for side effects. Errors are logged unless `hookConfig.errorHandling` is `'throw'`. */
export async function executeAfterHook(operation: Op, context: HandlerContext, result?: any, id?: string | number): Promise<void> {
  const hookName = `after${operation[0]!.toUpperCase()}${operation.slice(1)}` as keyof ResourceHooks
  const hooks = getAllHooks(context, hookName)
  if (hooks.length === 0) return

  const { timeout, parallel, errorHandling } = hookConfig(context)
  const args = operation === 'delete' ? [id, context] : [result, context]
  try {
    if (parallel && hooks.length > 1) await Promise.all(hooks.map(h => runWithTimeout(h, args, hookName, timeout)))
    else for (const hook of hooks) await runWithTimeout(hook, args, hookName, timeout)
  }
  catch (error) {
    if (errorHandling === 'throw') throw error
    console.error(`[nuxt-auto-api]`, new HookExecutionError(`${hookName} hook failed`, hookName, error as Error), error)
  }
}

/** Run `after*` hooks that may replace the returned data (create/update/get/list). */
export async function executeAfterHookWithTransform(operation: 'create' | 'update' | 'list' | 'get', context: HandlerContext, result?: any): Promise<any> {
  const hookName = `after${operation[0]!.toUpperCase()}${operation.slice(1)}` as keyof ResourceHooks
  const hooks = getAllHooks(context, hookName)
  if (hooks.length === 0) return result

  const { timeout, errorHandling } = hookConfig(context)
  let current = result
  try {
    for (const hook of hooks) {
      const r = await runWithTimeout(hook, [current, context], hookName, timeout)
      if (r !== undefined) current = r
    }
  }
  catch (error) {
    if (errorHandling === 'throw') throw error
    console.error(`[nuxt-auto-api]`, new HookExecutionError(`${hookName} hook failed`, hookName, error as Error), error)
  }
  return current
}

/**
 * Run hooks by exact name with the given arguments (M2M hooks: `beforeM2MSync(relation, ids, ctx)` …).
 * `before*` errors are re-thrown; `after*` errors follow `hookConfig.errorHandling` (default: log).
 */
export async function executeHook(hookName: keyof ResourceHooks, context: HandlerContext, ...args: any[]): Promise<any> {
  const hooks = getAllHooks(context, hookName)
  if (hooks.length === 0) return undefined

  const { timeout, errorHandling } = hookConfig(context)
  let last: any
  try {
    for (const hook of hooks) {
      const r = await runWithTimeout(hook, args, hookName, timeout)
      if (r !== undefined) last = r
    }
  }
  catch (error) {
    const isAfter = String(hookName).startsWith('after')
    if (isAfter && errorHandling !== 'throw') console.error(`[nuxt-auto-api] ${hookName} hook failed:`, error)
    else throw error
  }
  return last
}
