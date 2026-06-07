import { eq, getTableName } from 'drizzle-orm'
import { getTableConfig as sqliteTableConfig } from 'drizzle-orm/sqlite-core'
import { getTableConfig as pgTableConfig } from 'drizzle-orm/pg-core'
import { getTableConfig as mysqlTableConfig } from 'drizzle-orm/mysql-core'
import { createError } from 'h3'
import { getSoftDeleteColumn, buildSoftDeleteUpdates } from './softDelete'

/**
 * Cascade soft-delete (P15.2). When a row is soft-deleted, its FK children must be handled the same
 * way a hard delete's `ON DELETE` would have — reversibly. We discover children from drizzle FK
 * metadata and mirror each FK's `onDelete`:
 *   • cascade   → soft-delete soft-deletable children (recurse, same deletionId); non-soft-deletable
 *                 cascade children are left for the DB's real ON DELETE CASCADE at purge time.
 *   • set null  → null the child FK column on matching rows.
 *   • restrict / no action → throw 409 if any matching children exist.
 * The same `deletionId` is stamped on every cascaded row so a batch restore/purge acts on the unit.
 *
 * Two passes (the delete handler is not transactional): a recursive **restrict pre-flight** first, so
 * a blocked delete throws *before* any row is mutated — no partial cascade.
 */

interface FkEdge {
  columns: any[] // local (child) drizzle Column objects
  foreignTable: any
  onDelete?: string
}

/** Cross-dialect FK read: try each dialect's getTableConfig; the matching one succeeds. */
function tableForeignKeys(table: any): FkEdge[] {
  for (const getCfg of [sqliteTableConfig, pgTableConfig, mysqlTableConfig]) {
    try {
      const cfg: any = getCfg(table as any)
      return (cfg.foreignKeys ?? []).map((fk: any) => {
        const ref = fk.reference()
        return { columns: ref.columns, foreignTable: ref.foreignTable, onDelete: fk.onDelete }
      })
    }
    catch {
      // wrong dialect for this table — try the next
    }
  }
  return []
}

function safeTableName(table: any): string | null {
  try {
    return getTableName(table)
  }
  catch {
    return null
  }
}

/** Map an FK drizzle Column back to the table's property key (for `.set({ [key]: null })`). */
function fkColKey(table: any, col: any): string {
  for (const [key, value] of Object.entries(table)) {
    if (value === col) return key
  }
  return col.name
}

/** Child FK edges of a parent table, with the child resource name + table resolved. */
function childEdges(schema: Record<string, any>, parentTable: any): Array<{ resource: string, table: any, fkCol: any, onDelete: string }> {
  const parentName = safeTableName(parentTable)
  const out: Array<{ resource: string, table: any, fkCol: any, onDelete: string }> = []
  for (const [resource, table] of Object.entries(schema)) {
    if (table === parentTable) continue
    for (const fk of tableForeignKeys(table)) {
      if (safeTableName(fk.foreignTable) !== parentName) continue
      const fkCol = fk.columns[0]
      if (!fkCol) continue
      out.push({ resource, table, fkCol, onDelete: (fk.onDelete ?? 'no action').toLowerCase() })
    }
  }
  return out
}

/** Pass 1 — throw 409 if any restrict/no-action child (anywhere in the cascade subtree) has rows. */
async function preflightRestrict(
  context: any,
  parentResource: string,
  parentId: string | number,
  visited: Set<string>,
): Promise<void> {
  const schema: Record<string, any> = context.schema ?? {}
  const db = context.db
  const parentTable = schema[parentResource]
  if (!parentTable) return
  const key = `${parentResource}#${parentId}`
  if (visited.has(key)) return
  visited.add(key)

  for (const { resource, table, fkCol, onDelete } of childEdges(schema, parentTable)) {
    if (onDelete === 'cascade') {
      const childSoftCol = getSoftDeleteColumn(table)
      if (!childSoftCol) continue
      const rows = await db.select().from(table).where(eq(fkCol, parentId))
      for (const row of rows.filter((r: any) => r[childSoftCol] == null)) {
        await preflightRestrict(context, resource, row.id, visited)
      }
    }
    else if (onDelete !== 'set null') {
      const [child] = await db.select().from(table).where(eq(fkCol, parentId)).limit(1)
      if (child) {
        throw createError({
          statusCode: 409,
          message: `Cannot delete ${parentResource}: ${resource} rows reference it (onDelete: ${onDelete})`,
        })
      }
    }
  }
}

/** Pass 2 — soft-delete cascade children + null set-null FKs. Returns rows soft-deleted. */
async function applyCascade(
  context: any,
  parentResource: string,
  parentId: string | number,
  deletionId: string,
  reason: string | null,
  visited: Set<string>,
): Promise<number> {
  const schema: Record<string, any> = context.schema ?? {}
  const db = context.db
  const parentTable = schema[parentResource]
  if (!parentTable) return 0
  const key = `${parentResource}#${parentId}`
  if (visited.has(key)) return 0
  visited.add(key)

  const userId = context.user?.id ? String(context.user.id) : null
  let affected = 0

  for (const { resource, table, fkCol, onDelete } of childEdges(schema, parentTable)) {
    if (onDelete === 'cascade') {
      const childSoftCol = getSoftDeleteColumn(table)
      if (!childSoftCol) continue // non-soft-deletable: DB ON DELETE CASCADE handles it at purge
      const rows = await db.select().from(table).where(eq(fkCol, parentId))
      const liveRows = rows.filter((r: any) => r[childSoftCol] == null)
      if (liveRows.length === 0) continue

      await db.update(table).set(buildSoftDeleteUpdates(table, { deletionId, reason, userId })).where(eq(fkCol, parentId))
      affected += liveRows.length
      for (const row of liveRows) {
        affected += await applyCascade(context, resource, row.id, deletionId, reason, visited)
      }
    }
    else if (onDelete === 'set null') {
      await db.update(table).set({ [fkColKey(table, fkCol)]: null }).where(eq(fkCol, parentId))
    }
  }

  return affected
}

/**
 * Soft-delete all FK children of (parentResource, parentId), mirroring each FK's onDelete.
 * Restrict pre-flight runs first so nothing is mutated if the delete is blocked.
 */
export async function cascadeSoftDelete(
  context: any,
  parentResource: string,
  parentId: string | number,
  deletionId: string,
  opts: { reason?: string | null } = {},
): Promise<number> {
  await preflightRestrict(context, parentResource, parentId, new Set())
  return applyCascade(context, parentResource, parentId, deletionId, opts.reason ?? null, new Set())
}
