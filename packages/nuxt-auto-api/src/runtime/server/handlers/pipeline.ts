import { defineEventHandler } from 'h3'
import type { H3Event } from 'h3'
import type { HandlerContext } from '../../types'
import { createContextFromRegistry } from './createContextFromRegistry'

/**
 * The request pipeline shared by every generated route:
 *
 *   context (extenders, tenant) → pre-auth → authorize → post-auth → validate → pre-execute → handler → post-execute
 *
 * A `pre-execute` middleware may set `context.shortCircuit` (e.g. a cache hit) to skip the handler; a
 * `post-execute` middleware finds the handler's response on `context.result`.
 */
export async function runResourcePipeline<T>(
  event: H3Event,
  operation: HandlerContext['operation'],
  execute: (context: HandlerContext) => Promise<T>,
  opts: {
    bulk?: boolean
    validate?: boolean
    /** Replace the operation-level gate (restore, M2M decide their own). */
    authorize?: (context: HandlerContext) => Promise<void>
  } = {},
): Promise<T | any> {
  const { context, authorize, validate, runMiddleware } = await createContextFromRegistry(event, operation)
  if (opts.bulk) context.bulk = true

  await runMiddleware('pre-auth')
  await (opts.authorize ? opts.authorize(context) : authorize(context))
  await runMiddleware('post-auth')
  if (opts.validate !== false) await validate(context)
  await runMiddleware('pre-execute')

  if (context.shortCircuit) {
    await runMiddleware('post-execute')
    return context.shortCircuit.data
  }

  const result = await execute(context)
  context.result = result
  await runMiddleware('post-execute')
  return result
}

export function defineResourceRoute<T>(
  operation: HandlerContext['operation'],
  execute: (context: HandlerContext) => Promise<T>,
  opts?: Parameters<typeof runResourcePipeline>[3],
) {
  return defineEventHandler(event => runResourcePipeline(event, operation, execute, opts))
}
