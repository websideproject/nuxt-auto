import type { AutoApiMiddleware, ContextExtender, MiddlewareStage } from '../../types/plugin'
import type { ResourceHooks, HandlerContext } from '../../types'

interface PluginRegistryState {
  middleware: AutoApiMiddleware[]
  contextExtenders: ContextExtender[]
  globalHooks: ResourceHooks[]
  resourceHooks: Record<string, ResourceHooks[]>
  initialized: boolean
}

declare global {
  var __autoApiPluginRegistry: PluginRegistryState | undefined
}

function getRegistry(): PluginRegistryState {
  if (!globalThis.__autoApiPluginRegistry) {
    globalThis.__autoApiPluginRegistry = {
      middleware: [],
      contextExtenders: [],
      globalHooks: [],
      resourceHooks: {},
      initialized: false,
    }
  }
  return globalThis.__autoApiPluginRegistry
}

/**
 * Register a middleware
 */
export function addMiddleware(middleware: AutoApiMiddleware): void {
  const registry = getRegistry()
  registry.middleware.push(middleware)
  // Keep sorted by order
  registry.middleware.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/**
 * Register a context extender
 */
export function addContextExtender(fn: ContextExtender): void {
  getRegistry().contextExtenders.push(fn)
}

/**
 * Register resource-specific hooks
 */
export function addResourceHook(resource: string, hooks: ResourceHooks): void {
  const registry = getRegistry()
  if (!registry.resourceHooks[resource]) {
    registry.resourceHooks[resource] = []
  }
  registry.resourceHooks[resource].push(hooks)
}

/**
 * Register global hooks (apply to all resources)
 */
export function addGlobalHook(hooks: ResourceHooks): void {
  getRegistry().globalHooks.push(hooks)
}

/**
 * Get middleware for a specific stage, optionally filtered by resource and operation
 */
export function getMiddlewareForStage(
  stage: MiddlewareStage,
  resource?: string,
  operation?: HandlerContext['operation']
): AutoApiMiddleware[] {
  const registry = getRegistry()
  return registry.middleware.filter(mw => {
    if (mw.stage !== stage) return false
    if (mw.resources && resource && !mw.resources.includes(resource)) return false
    if (mw.operations && operation && !mw.operations.includes(operation)) return false
    return true
  })
}

/**
 * Get all registered context extenders
 */
export function getContextExtenders(): ContextExtender[] {
  return getRegistry().contextExtenders
}

/**
 * Get plugin hooks for a resource and hook name
 */
export function getPluginHooks(
  resource: string,
  hookName: keyof ResourceHooks
): Function[] {
  const registry = getRegistry()
  const hooks: Function[] = []

  // Global hooks
  for (const globalHook of registry.globalHooks) {
    const fn = globalHook[hookName]
    if (fn && typeof fn === 'function') {
      hooks.push(fn as Function)
    }
  }

  // Resource-specific hooks
  const resourceHooksList = registry.resourceHooks[resource]
  if (resourceHooksList) {
    for (const resourceHook of resourceHooksList) {
      const fn = resourceHook[hookName]
      if (fn && typeof fn === 'function') {
        hooks.push(fn as Function)
      }
    }
  }

  return hooks
}

/**
 * Mark the plugin system as initialized
 */
export function markInitialized(): void {
  getRegistry().initialized = true
}

/**
 * Check if the plugin system has been initialized
 */
export function isInitialized(): boolean {
  return getRegistry().initialized
}
