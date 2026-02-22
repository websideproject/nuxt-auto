import type { Nuxt } from '@nuxt/schema'
import type { Resolver } from '@nuxt/kit'
import type { HandlerContext, AutoApiOptions } from './index'

/**
 * Middleware execution stages in the request pipeline
 */
export type MiddlewareStage = 'pre-auth' | 'post-auth' | 'pre-execute' | 'post-execute'

/**
 * Plugin middleware definition
 */
export interface AutoApiMiddleware {
  /** Unique name for this middleware */
  name: string
  /** Execution order (lower = earlier). Default: 0 */
  order?: number
  /** Pipeline stage where this middleware runs */
  stage: MiddlewareStage
  /** Limit to specific resources (undefined = all) */
  resources?: string[]
  /** Limit to specific operations (undefined = all) */
  operations?: Array<HandlerContext['operation']>
  /** Middleware handler */
  handler: (context: HandlerContext) => void | Promise<void>
}

/**
 * Context extender function - runs on every request to enrich HandlerContext
 */
export type ContextExtender = (context: HandlerContext) => void | Promise<void>

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
  debug: (...args: any[]) => void
}

/**
 * Build-time context available to plugins during module setup
 */
export interface PluginBuildContext {
  /** Add a server handler (API route) */
  addServerHandler: (handler: any) => void
  /** Add server-side auto-import directory */
  addServerImportsDir: (dir: string) => void
  /** Add client-side auto-import directory */
  addImportsDir: (dir: string) => void
  /** Add a server plugin (Nitro plugin) */
  addServerPlugin: (plugin: string) => void
  /** Add a client/universal plugin */
  addPlugin: (plugin: any) => void
  /** Add a virtual template */
  addTemplate: (template: any) => void
  /** Mutable module options */
  options: AutoApiOptions
  /** Nuxt instance */
  nuxt: Nuxt
  /** Module path resolver */
  resolver: Resolver
  /** Logger */
  logger: PluginLogger
}

/**
 * Runtime context available to plugins during server initialization
 */
export interface PluginRuntimeContext {
  /** Register middleware for a specific pipeline stage */
  addMiddleware: (middleware: AutoApiMiddleware) => void
  /** Register resource-specific hooks */
  addHook: (resource: string, hooks: import('./index').ResourceHooks) => void
  /** Register hooks that apply to all resources */
  addGlobalHook: (hooks: import('./index').ResourceHooks) => void
  /** Register a context extender that runs on every request */
  extendContext: (fn: ContextExtender) => void
  /** Runtime configuration */
  runtimeConfig: any
  /** Logger */
  logger: PluginLogger
}

/**
 * Auto API Plugin definition
 */
export interface AutoApiPlugin {
  /** Unique plugin name */
  name: string
  /** Plugin version */
  version?: string
  /** Build-time setup (runs during Nuxt module setup) */
  buildSetup?: (context: PluginBuildContext) => void | Promise<void>
  /** Runtime setup (runs when server starts via Nitro plugin) */
  runtimeSetup?: (context: PluginRuntimeContext) => void | Promise<void>
}

/**
 * Identity helper for type inference when defining plugins
 */
export function defineAutoApiPlugin(plugin: AutoApiPlugin): AutoApiPlugin {
  return plugin
}
