import { getPermissionEvaluators } from '../plugins/pluginRegistry'
import type { HandlerContext } from '../../types'

/**
 * Resolve a structured (object) permission value via the registered evaluator chain.
 * Generic seam: auto-api never inspects the object's shape — each registered evaluator decides
 * whether the value is "theirs" (return boolean) or not (return undefined → try the next).
 * If no evaluator handles it, deny-closed (a typo/missing registration must not grant access).
 *
 * Shared by both permission resolvers (`hasPermission` = the request gate, and
 * `evaluatePermission` = the `/api/permissions` introspection path) so they decide identically.
 */
export async function resolveObjectPermission(
  value: Record<string, any>,
  context: HandlerContext,
): Promise<boolean> {
  const evaluators = getPermissionEvaluators()
  for (const evaluate of evaluators) {
    const result = await evaluate(value, context)
    if (result !== undefined) return result
  }
  console.warn('[nuxt-auto-api] object permission value had no registered evaluator → denying:', value)
  return false
}
