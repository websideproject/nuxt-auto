import type { HandlerContext, ResourceHooks } from '../../types'
import { getPluginHooks } from '../plugins/pluginRegistry'

/**
 * Hook execution error
 */
export class HookExecutionError extends Error {
  constructor(
    message: string,
    public hookName: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'HookExecutionError'
  }
}

/**
 * Get all hooks for a resource and hook name
 * Priority (lowest to highest):
 * 1. Config-based (from nuxt.config.ts)
 * 2. Legacy globalThis.__autoApiHooks
 * 3. Plugin-registry (from plugin system)
 * 4. Per-resource (from registry via createModuleImport) - highest priority
 */
function getAllHooks(
  context: HandlerContext,
  hookName: keyof ResourceHooks
): Array<Function> {
  const hooks: Array<Function> = []
  const { resource, resourceConfig } = context

  // Get config from runtime
  const runtimeConfig = useRuntimeConfig?.()

  // Config hooks (lowest priority)
  const configHooks = runtimeConfig?.autoApi?.hooks?.[resource]?.[hookName]
  if (configHooks && typeof configHooks === 'function') {
    hooks.push(configHooks)
  }

  // Legacy globalThis hooks
  const legacyHooks = (globalThis as any).__autoApiHooks?.[resource]?.[hookName]
  if (legacyHooks && typeof legacyHooks === 'function') {
    hooks.push(legacyHooks)
  }

  // Plugin-registry hooks (from plugin system)
  const pluginRegistryHooks = getPluginHooks(resource, hookName)
  hooks.push(...pluginRegistryHooks)

  // Registry hooks (highest priority, from virtual module)
  const registryHooks = resourceConfig?.hooks?.[hookName]
  if (registryHooks && typeof registryHooks === 'function') {
    hooks.push(registryHooks)
  }

  return hooks
}

/**
 * Execute a single hook with timeout and error handling
 */
async function executeSingleHook(
  hook: Function,
  args: any[],
  hookName: string,
  timeout: number = 5000
): Promise<any> {
  return Promise.race([
    hook(...args),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Hook ${hookName} timed out after ${timeout}ms`)),
        timeout
      )
    ),
  ])
}

/**
 * Execute before hooks (can modify data)
 * Returns the potentially modified data
 */
export async function executeBeforeHook(
  operation: 'create' | 'update' | 'delete' | 'list' | 'get',
  context: HandlerContext,
  data?: any,
  id?: string | number
): Promise<any> {
  const hookName = `before${operation.charAt(0).toUpperCase()}${operation.slice(1)}` as keyof ResourceHooks
  const hooks = getAllHooks(context, hookName)

  if (hooks.length === 0) {
    return data
  }

  const runtimeConfig = useRuntimeConfig?.()
  const timeout = runtimeConfig?.autoApi?.hookConfig?.timeout || 5000
  const parallel = runtimeConfig?.autoApi?.hookConfig?.parallel || false
  const errorHandling = runtimeConfig?.autoApi?.hookConfig?.errorHandling || 'throw'

  let currentData = data

  try {
    if (parallel && hooks.length > 1) {
      // Execute hooks in parallel
      // Note: In parallel mode, each hook receives the original data
      const results = await Promise.all(
        hooks.map(hook => {
          const args = operation === 'update' || operation === 'delete' || operation === 'get'
            ? [id, currentData, context]
            : operation === 'list'
            ? [context]
            : [currentData, context]
          return executeSingleHook(hook, args, hookName, timeout)
        })
      )

      // For before hooks, use the last non-undefined result
      for (const result of results.reverse()) {
        if (result !== undefined) {
          currentData = result
          break
        }
      }
    } else {
      // Execute hooks sequentially (default)
      for (const hook of hooks) {
        const args = operation === 'update' || operation === 'delete' || operation === 'get'
          ? [id, currentData, context]
          : operation === 'list'
          ? [context]
          : [currentData, context]

        const result = await executeSingleHook(hook, args, hookName, timeout)

        // If hook returns a value, use it as the new data
        if (result !== undefined) {
          currentData = result
        }
      }
    }
  } catch (error) {
    const hookError = new HookExecutionError(
      `Error executing ${hookName} hook`,
      hookName,
      error as Error
    )

    // Before hooks should throw errors (block operation)
    if (errorHandling === 'throw') {
      throw hookError
    } else {
      console.error(`[autoApi] ${hookError.message}:`, error)
    }
  }

  return currentData
}

/**
 * Execute after hooks (cannot modify data, side effects only)
 */
export async function executeAfterHook(
  operation: 'create' | 'update' | 'delete' | 'list' | 'get',
  context: HandlerContext,
  result?: any,
  id?: string | number
): Promise<void> {
  const hookName = `after${operation.charAt(0).toUpperCase()}${operation.slice(1)}` as keyof ResourceHooks
  const hooks = getAllHooks(context, hookName)

  if (hooks.length === 0) {
    return
  }

  const runtimeConfig = useRuntimeConfig?.()
  const timeout = runtimeConfig?.autoApi?.hookConfig?.timeout || 5000
  const parallel = runtimeConfig?.autoApi?.hookConfig?.parallel || false
  const errorHandling = runtimeConfig?.autoApi?.hookConfig?.errorHandling || 'log'

  try {
    if (parallel && hooks.length > 1) {
      // Execute hooks in parallel
      await Promise.all(
        hooks.map(hook => {
          const args = operation === 'delete'
            ? [id, context]
            : [result, context]
          return executeSingleHook(hook, args, hookName, timeout)
        })
      )
    } else {
      // Execute hooks sequentially
      for (const hook of hooks) {
        const args = operation === 'delete'
          ? [id, context]
          : [result, context]

        await executeSingleHook(hook, args, hookName, timeout)
      }
    }
  } catch (error) {
    const hookError = new HookExecutionError(
      `Error executing ${hookName} hook`,
      hookName,
      error as Error
    )

    // After hooks should not throw by default (don't rollback)
    if (errorHandling === 'throw') {
      throw hookError
    } else {
      console.error(`[autoApi] ${hookError.message}:`, error)
    }
  }
}

/**
 * Execute after hooks that can transform the result.
 * If a hook returns a non-undefined value, it replaces the data for subsequent hooks.
 * Backward compatible: hooks returning void/undefined are treated as side-effect-only.
 */
export async function executeAfterHookWithTransform(
  operation: 'create' | 'update' | 'list' | 'get',
  context: HandlerContext,
  result?: any,
): Promise<any> {
  const hookName = `after${operation.charAt(0).toUpperCase()}${operation.slice(1)}` as keyof ResourceHooks
  const hooks = getAllHooks(context, hookName)

  if (hooks.length === 0) {
    return result
  }

  const runtimeConfig = useRuntimeConfig?.()
  const timeout = runtimeConfig?.autoApi?.hookConfig?.timeout || 5000
  const errorHandling = runtimeConfig?.autoApi?.hookConfig?.errorHandling || 'log'

  let currentResult = result

  try {
    for (const hook of hooks) {
      const args = [currentResult, context]
      const hookResult = await executeSingleHook(hook, args, hookName, timeout)
      if (hookResult !== undefined) {
        currentResult = hookResult
      }
    }
  } catch (error) {
    const hookError = new HookExecutionError(
      `Error executing ${hookName} hook`,
      hookName,
      error as Error
    )

    if (errorHandling === 'throw') {
      throw hookError
    } else {
      console.error(`[autoApi] ${hookError.message}:`, error)
    }
  }

  return currentResult
}

/**
 * Execute a generic hook by name
 */
export async function executeHook(
  hookName: keyof ResourceHooks,
  context: HandlerContext,
  ...args: any[]
): Promise<any> {
  const hooks = getAllHooks(context, hookName)

  if (hooks.length === 0) {
    return
  }

  const runtimeConfig = useRuntimeConfig?.()
  const timeout = runtimeConfig?.autoApi?.hookConfig?.timeout || 5000
  const parallel = runtimeConfig?.autoApi?.hookConfig?.parallel || false

  if (parallel && hooks.length > 1) {
    const results = await Promise.all(
      hooks.map(hook => executeSingleHook(hook, args, hookName, timeout))
    )
    // Return the last non-undefined result
    for (const result of results.reverse()) {
      if (result !== undefined) {
        return result
      }
    }
  } else {
    let lastResult: any
    for (const hook of hooks) {
      const result = await executeSingleHook(hook, args, hookName, timeout)
      if (result !== undefined) {
        lastResult = result
      }
    }
    return lastResult
  }
}
