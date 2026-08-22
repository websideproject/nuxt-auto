import { createError } from 'h3'
import { checkFieldPermission } from './permissions'
import type { HandlerContext, ResourceAuthConfig } from '../../types'

/**
 * Enforcement for `ResourceAuthConfig.fields[x].{read,write}`.
 *
 * ── What was wrong ─────────────────────────────────────────────────────────────────────────────────────
 * Both halves were declarative only. `getResourcePermissions` REPORTED them through `/api/<r>/permissions`,
 * and nothing consulted them on any request path:
 *
 *   · the write half had no implementation at all — a `PATCH` rewrote a column declared `write: () => false`
 *     and returned 200;
 *   · the read half had one (`filterFieldsByPermission` in `middleware/authz.ts`) that **no handler ever
 *     called** — its only caller in the repo is its own unit test.
 *
 * So `GET /api/studioPaymentSources` returned `signingSecretEncrypted` in the same response whose
 * `/permissions` sibling said `canRead: false`, and the same held for every other declaration in the
 * monorepo: `feedbackItems.adminNotes` and `.ipAddress` to any reader, `newsletterSubscribers
 * .unsubscribeToken`, `notificationRules.webhookUrl`, and four encrypted-secret columns whose own comment
 * said "the client must never receive" it.
 *
 * ── The rules ──────────────────────────────────────────────────────────────────────────────────────────
 * **Read is a filter; write is a refusal.** They are asymmetric on purpose:
 *
 *   · a field you may not READ is removed from the response. Refusing the whole request instead would make
 *     an ordinary list 403 for an ordinary user, which is not what "you cannot see this column" means.
 *   · a field you may not WRITE makes the request fail with 403, naming the fields. Dropping it silently is
 *     the failure this module keeps finding — a caller that believes it saved something that never saved.
 *     A declaration that means "you may not set this" has to be observable when you try.
 *
 * **The write gate is on the REQUEST BODY, before hooks.** `beforeCreate`/`beforeUpdate` hooks write fields
 * on the server's own behalf (tenancy injection, derived totals, evidence-dropping) and must not be gated
 * by what the caller may write — the point of the gate is what the CALLER asked for.
 *
 * **`fields` is per resource, never a union of names.** Unlike `hiddenFields`, which strips a flat set of
 * names across every resource, a field permission belongs to the resource that declared it: `content` is
 * denied on `yjsDocuments` and is ordinary text on four other tables, and `error`, `metadata` and
 * `scheduledFor` collide the same way. A union would blank columns nobody restricted.
 *
 * ⚠ **Root resource only.** Fields reached through `?include=` are the nested resource's, and resolving a
 * relation key to a resource name is not something the registry can answer today. See
 * `test/unit/utils/fieldPermissions.test.ts`, which pins that limit rather than leaving it implied.
 *
 * ⚠ **Evaluated through `checkFieldPermission`, which is what `/permissions` reports with** — deliberately
 * NOT through `hasPermission`, whose first line is `if (userPermissions.includes('*')) return true`. A
 * platform admin holding `*` would sail through `read: () => false`, whose own comment says "not even by a
 * platform admin", and — worse — the enforcement would then disagree with the report. Two answers to one
 * question is the bug this file exists to remove, so there is one evaluator.
 */

/** The merged auth config for the resource being handled, if any. */
function authOf(context: HandlerContext): ResourceAuthConfig | undefined {
  return (context as any).effectiveAuth ?? context.resourceConfig?.authorization
}

/**
 * Fields of `data` the caller may not write.
 *
 * A field with no entry, or an entry with no `write`, is unrestricted — `{ read: isAdmin }` alone
 * restricts reading and says nothing about writing.
 */
export async function deniedWriteFields(data: any, context: HandlerContext): Promise<string[]> {
  const fields = authOf(context)?.fields
  if (!fields || !data || typeof data !== 'object') return []

  const denied: string[] = []
  for (const key of Object.keys(data)) {
    if (fields[key]?.write === undefined) continue
    if (!await checkFieldPermission(key, 'write', authOf(context), context)) denied.push(key)
  }
  return denied
}

/**
 * Refuse a create/update that tries to set fields the caller may not write.
 *
 * 403 with the field names, because "Forbidden" alone against a body of twenty keys is a debugging session.
 * 401 when there is no user at all, matching the operation-level gate.
 */
export async function assertWritableFields(data: any, context: HandlerContext): Promise<void> {
  const denied = await deniedWriteFields(data, context)
  if (!denied.length) return
  throw createError({
    statusCode: context.user ? 403 : 401,
    message: context.user
      ? `Forbidden: You don't have permission to write ${denied.join(', ')} on this resource`
      : 'Authentication required',
  })
}

/**
 * Remove the fields the caller may not read from a record, or from every record in an array.
 *
 * Evaluated ONCE per request rather than per row: a field permission takes the context, not the row, so
 * the answer cannot differ between two rows of the same response.
 */
export async function filterReadableFields<T = any>(data: T | T[], context: HandlerContext): Promise<T | T[]> {
  const fields = authOf(context)?.fields
  if (!fields || !data) return data

  const denied: string[] = []
  for (const [name, rule] of Object.entries(fields)) {
    if (rule?.read === undefined) continue
    if (!await checkFieldPermission(name, 'read', authOf(context), context)) denied.push(name)
  }
  if (!denied.length) return data

  const strip = (row: any) => {
    if (!row || typeof row !== 'object') return row
    const out: any = { ...row }
    for (const f of denied) delete out[f]
    return out
  }
  return Array.isArray(data) ? (data.map(strip) as T[]) : (strip(data) as T)
}
