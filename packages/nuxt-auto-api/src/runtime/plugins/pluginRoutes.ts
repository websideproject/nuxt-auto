import type { PluginBuildContext } from '../types/plugin'

export interface ResourceRoute {
  /** Path under the resource, e.g. `/export` → `/api/{resource}/export`. */
  path: string
  method: 'get' | 'post' | 'delete'
  handler: string
  /** Resources to add it to (undefined = every registered resource). */
  resources?: string[]
}

/**
 * Register the API routes a plugin adds. A route handler must be a FILE (Nitro bundles it); the plugin's options
 * travel to it as data in `runtimeConfig.autoApiPluginRoutes[name]`. The handlers live in
 * `runtime/server/handlers/plugins/` and authorize exactly like the generated routes.
 *
 * Routes under a resource are registered by the module next to the resource's own routes, one per resource:
 * a `/api/:resource/…` pattern would lose to the generated `/api/posts/:id` (the router prefers the static
 * segment and does not backtrack).
 */
export function registerPluginRoutes(
  ctx: PluginBuildContext,
  name: string,
  config: Record<string, unknown>,
  routes: Array<{ path: string, method: 'get' | 'post' | 'delete', handler: string }>,
  resourceRoutes: ResourceRoute[] = [],
): void {
  const prefix = (ctx.options?.prefix || '/api').replace(/\/+$/, '')
  const runtimeConfig = ctx.nuxt.options.runtimeConfig as Record<string, any>
  runtimeConfig.autoApiPluginRoutes = { ...runtimeConfig.autoApiPluginRoutes, [name]: JSON.parse(JSON.stringify(config)) }
  const handler = (file: string) => ctx.resolver.resolve(`./runtime/server/handlers/plugins/${file}`)
  for (const route of routes) {
    ctx.addServerHandler({ route: `${prefix}${route.path}`, method: route.method, handler: handler(route.handler) })
  }
  const pending: ResourceRoute[] = ((ctx.nuxt as any)._autoApiResourceRoutes ||= [])
  for (const route of resourceRoutes) pending.push({ ...route, handler: handler(route.handler) })
}
