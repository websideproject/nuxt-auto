import type { AutoApiMiddleware, ContextExtender, ContextExtenderOptions, MiddlewareStage } from '../../types/plugin'
import type { ResourceHooks, HandlerContext, PermissionEvaluator } from '../../types'

interface PluginRegistryState {
  middleware: AutoApiMiddleware[]
  /** In run order (see `addContextExtender`), derived from `contextExtenderEntries`. */
  contextExtenders: ContextExtender[]
  contextExtenderEntries?: Array<{ fn: ContextExtender, order: number, name?: string }>
  globalHooks: ResourceHooks[]
  resourceHooks: Record<string, ResourceHooks[]>
  permissionEvaluators: PermissionEvaluator[]
  protectedFields: Record<string, string[]>
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
      contextExtenderEntries: [],
      globalHooks: [],
      resourceHooks: {},
      permissionEvaluators: [],
      protectedFields: {},
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
 * Register a context extender: it runs on every request, before authorization, and may attach data or resolvers to the
 * handler context. Extenders run by `order` (lower first, default `0`), and in registration order within one `order`,
 * so one that reads what another sets can say it runs later: `addContextExtender(fn, { order: 10 })`. Nitro plugins
 * and auto-api plugins start in an order neither controls, so an `order` is the dependable way to sequence two.
 */
export function addContextExtender(fn: ContextExtender, options: ContextExtenderOptions = {}): void {
  const registry = getRegistry()
  // A registry made by an older copy of this module has no entries yet: start them from what it holds.
  registry.contextExtenderEntries ??= registry.contextExtenders.map(f => ({ fn: f, order: 0 }))
  registry.contextExtenderEntries.push({ fn, order: options.order ?? 0, name: options.name })
  // Array#sort is stable: within one `order`, registration order stays.
  registry.contextExtenderEntries.sort((a, b) => a.order - b.order)
  registry.contextExtenders = registry.contextExtenderEntries.map(e => e.fn)
}

/**
 * Register an evaluator for structured (object) permission values. Generic seam — auto-api
 * never interprets the object; registered evaluators do. First evaluator returning a non-undefined
 * result wins. Registered from outside via the plugin runtime context.
 */
export function registerPermissionEvaluator(fn: PermissionEvaluator): void {
  getRegistry().permissionEvaluators.push(fn)
}

/**
 * Get all registered permission evaluators (for object-form permission values).
 */
export function getPermissionEvaluators(): PermissionEvaluator[] {
  return getRegistry().permissionEvaluators
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
 * Declare columns of `resource` that request bodies may never set — like a registration's `protectedFields`, for
 * a plugin whose hooks fill them on the server (the API token plugin's hash and owner). They are left out of the
 * generated validation schemas, so they are never required, and dropped from bodies before hooks run.
 */
export function addProtectedFields(resource: string, fields: string[]): void {
  const registry = getRegistry()
  registry.protectedFields[resource] = [...new Set([...(registry.protectedFields[resource] ?? []), ...fields])]
}

/** Columns plugins declared server-owned for `resource` (see `addProtectedFields`). */
export function getPluginProtectedFields(resource: string): string[] {
  return getRegistry().protectedFields[resource] ?? []
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
  operation?: HandlerContext['operation'],
): AutoApiMiddleware[] {
  const registry = getRegistry()
  return registry.middleware.filter((mw) => {
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
  hookName: keyof ResourceHooks,
): Array<(...args: any[]) => any> {
  const registry = getRegistry()
  const hooks: Array<(...args: any[]) => any> = []

  // Global hooks
  for (const globalHook of registry.globalHooks) {
    const fn = globalHook[hookName]
    if (fn && typeof fn === 'function') {
      hooks.push(fn as (...args: any[]) => any)
    }
  }

  // Resource-specific hooks
  const resourceHooksList = registry.resourceHooks[resource]
  if (resourceHooksList) {
    for (const resourceHook of resourceHooksList) {
      const fn = resourceHook[hookName]
      if (fn && typeof fn === 'function') {
        hooks.push(fn as (...args: any[]) => any)
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
