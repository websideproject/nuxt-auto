import type { H3Event } from 'h3'
import { createError } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import type { HandlerContext } from '../../types'
import { createContextFromRegistry, resourceFromPath } from '../handlers/createContextFromRegistry'

/** The resource a plugin's per-resource route (`/api/{resource}/export`) was registered for. */
export function routeResource(event: H3Event): string {
  const resource = resourceFromPath(event, (useRuntimeConfig(event) as any).autoApi?.prefix || '/api')
  if (!resource) throw createError({ statusCode: 404, message: 'Resource not found' })
  return resource
}

/**
 * The request context of a generated route, for a route a plugin adds (export, activity feed, audit log, file
 * upload): the caller, the tenant, the operation's permission gate and the plugin middleware — so the plugin's
 * route is exactly as protected as `GET /api/{resource}` (or `PATCH /api/{resource}/:id` for `update`).
 */
export async function authorizedContext(event: H3Event, resource: string, operation: 'list' | 'update'): Promise<HandlerContext> {
  const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, operation, { resource })
  await runMiddleware('pre-auth')
  await authorize(context)
  await runMiddleware('post-auth')
  if (operation === 'list') await validate(context)
  return context
}
