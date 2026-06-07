/**
 * Revision history plugin — hooks-only version.
 *
 * Stores a committed-state snapshot on every create / update / delete.
 * The list + restore endpoints live in module-auto-revision (which owns the schema
 * and routes them through the full auth pipeline).
 *
 * Changes from v1:
 *  - Dropped the two unauthenticated list/restore endpoints (replaced by module-auto-revision).
 *  - Switched to "after" (committed-state) snapshots: v1 = creation, vN = state after Nth write.
 *  - Added create and delete snapshots (beforeDelete stashes the row; afterDelete records it).
 *  - Captures organizationId from ctx.user (org-aware, degrades gracefully to null for non-org apps).
 *  - Strips configurable sensitive fields from snapshots.
 *  - Single-statement version increment (avoids SELECT-then-INSERT race).
 *  - Single-DELETE prune (one statement to remove oldest beyond the cap).
 *  - Honours context._revOperation (e.g. 'soft-delete') and context._revReason set by callers.
 */

import { eq, and, desc, sql, notInArray } from 'drizzle-orm'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'

export interface RevisionPluginOptions {
  /** Resources to track. undefined = all registered resources. */
  resources?: string[]
  /** Drizzle table name for revisions in the registry. @default 'revisions' */
  table?: string
  /** Which operations produce a snapshot. @default ['create','update','delete'] */
  snapshotOn?: Array<'create' | 'update' | 'delete'>
  /** Maximum revisions to keep per record (0 = unlimited). @default 50 */
  maxRevisionsPerRecord?: number
  /** Field names stripped from every snapshot (e.g. password hashes). */
  excludeFields?: string[]
  /** Per-resource field exclusions merged on top of excludeFields. */
  excludeFieldsByResource?: Record<string, string[]>
}

function strip(obj: any, fields: string[]): any {
  if (!obj || !fields.length) return obj
  const o = { ...obj }
  for (const f of fields) delete o[f]
  return o
}

export function createRevisionPlugin(opts: RevisionPluginOptions = {}): AutoApiPlugin {
  const revTable = opts.table ?? 'revisions'
  const on = new Set(opts.snapshotOn ?? ['create', 'update', 'delete'])
  const max = opts.maxRevisionsPerRecord ?? 50
  const track = (r: string) => !opts.resources || opts.resources.includes(r)
  const fieldsFor = (r: string): string[] => [
    ...(opts.excludeFields ?? []),
    ...(opts.excludeFieldsByResource?.[r] ?? []),
  ]

  async function record(ctx: any, op: string, snapshot: any): Promise<void> {
    const rev = ctx.schema[revTable]
    if (!rev || !snapshot) return

    const recordId = String(snapshot.id ?? snapshot.recordId ?? '')
    const data = strip(snapshot, fieldsFor(ctx.resource))
    const orgId = (ctx.user as any)?.organizationId ?? null

    // Allow callers (e.g. soft-delete handler) to override the operation label.
    const effectiveOp = (ctx as any)._revOperation ?? op
    const reason = (ctx as any)._revReason ?? null

    try {
      // Single-statement version increment: no separate SELECT → no race.
      await ctx.db.insert(rev).values({
        resource: ctx.resource,
        recordId,
        version: sql`(SELECT COALESCE(MAX(${rev.version}),0)+1 FROM ${rev}
                       WHERE ${rev.resource}=${ctx.resource} AND ${rev.recordId}=${recordId})`,
        operation: effectiveOp,
        data,
        userId: ctx.user?.id ? String(ctx.user.id) : null,
        organizationId: orgId,
        authMethod: (ctx as any).authMethod ?? null,
        reason,
      })

      if (max > 0) {
        // Prune to the newest `max` revisions. Select the ids to KEEP (LIMIT max — valid on all
        // dialects) and delete everything else for this record. Avoids OFFSET-without-LIMIT, which
        // is invalid in SQLite and not portable (LIMIT -1 / LIMIT ALL differ per engine).
        const idsToKeep = ctx.db
          .select({ id: rev.id }).from(rev)
          .where(and(eq(rev.resource, ctx.resource), eq(rev.recordId, recordId)))
          .orderBy(desc(rev.version))
          .limit(max)

        await ctx.db.delete(rev).where(and(
          eq(rev.resource, ctx.resource),
          eq(rev.recordId, recordId),
          notInArray(rev.id, idsToKeep),
        ))
      }
    }
    catch (err) {
      console.error('[autoApi:revision] write failed:', err)
    }
  }

  return defineAutoApiPlugin({
    name: 'revision-history',
    version: '2.0.0',
    runtimeSetup(ctx) {
      ctx.addGlobalHook({
        afterCreate(result: any, c: any) {
          if (on.has('create') && track(c.resource)) return record(c, 'create', result)
        },
        afterUpdate(result: any, c: any) {
          if (on.has('update') && track(c.resource)) return record(c, 'update', result)
        },
        async beforeDelete(id: any, c: any) {
          if (!on.has('delete') || !track(c.resource)) return
          const t = c.schema[c.resource]
          if (!t) return
          const pid = /^\d+$/.test(String(id)) ? Number(id) : id
          const [row] = await c.db.select().from(t).where(eq(t.id, pid)).catch(() => [null])
          ;(c as any)._revDeleted = row ?? null
        },
        afterDelete(_id: any, c: any) {
          if (!on.has('delete') || !track(c.resource)) return
          return record(c, 'delete', (c as any)._revDeleted)
        },
      })

      ctx.logger.info(`Revision history: ${opts.resources?.join(', ') || 'all'} (max ${max}/record)`)
    },
  })
}
