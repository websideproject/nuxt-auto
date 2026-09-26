import { and, getTableName, inArray, is, Many } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext } from '../../types'
import { getAuthConfig } from './authConfig'
import { buildWhereClause } from './buildWhereClause'
import { checkFieldPermission, checkPermission } from './permissions'
import { hiddenFieldsOf, readableColumns } from './queryFields'
import { contextFor, passesObjectLevel, rowScope } from './rowAccess'
import { getSoftDeleteColumn } from './softDelete'
import { getColumns, primaryKeyColumn, primaryKeyName } from './table'
import { getTenancyConfig, rowInTenant, tenantField } from './tenant'
import { selectInChunks } from './atomicWrites'

/**
 * `?include=` — relations loaded alongside the resource, authorized like the resource itself.
 *
 * Syntax (comma-separated, nested with dots):
 *
 *   include=author,comments
 *   include=comments.author
 *   include=author[id,name]                        field selection
 *   include=comments{limit:5,offset:10}            pagination (to-many only)
 *   include=comments{filter:{approved:true}}       filtering  (to-many only)
 *
 * Every included relation is checked against the resource that owns the related table:
 *
 *  - its `read` permission — a relation you may not read is a 403, not an empty key
 *  - its row visibility (tenant, `listFilter`, soft delete) and `objectLevel` — rows you may not see are
 *    dropped from to-many relations and nulled on to-one relations
 *  - its readable columns — field selection and filters may only name those; field-level `read` rules
 *    strip the same columns they strip from the resource's own responses
 *
 * A related table that is not a registered resource (a junction or child table the app never exposed) is
 * treated as part of its parent: no permission of its own, but tenant and soft-delete visibility still apply.
 */

export interface IncludeSpec {
  relation: string
  fields?: string[]
  filter?: Record<string, any>
  limit?: number
  offset?: number
  children: IncludeSpec[]
}

interface IncludeNode {
  spec: IncludeSpec
  path: string
  many: boolean
  table: any
  /** Registered resource that owns the table, if any. */
  resource?: string
  /** Name used for tenancy / hidden-field lookups (resource, or the Drizzle export name). */
  scopeName: string
  /** Columns added only so the rows can be authorized; stripped before the response. */
  extraColumns: string[]
  children: IncludeNode[]
}

export interface IncludePlan {
  with: Record<string, any>
  nodes: IncludeNode[]
  /** Drizzle relational-query key of the root table (`db.query[queryKey]`). */
  queryKey: string
}

function bad(message: string, statusCode = 400): never {
  throw createError({ statusCode, message })
}

// ── Parsing ──────────────────────────────────────────────────────────────────────────────────────────────

/** Split on `sep` outside `[]` / `{}`. */
function splitTopLevel(input: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of input) {
    if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') depth--
    if (ch === sep && depth === 0) {
      out.push(current)
      current = ''
    }
    else {
      current += ch
    }
  }
  out.push(current)
  return out.map(s => s.trim()).filter(Boolean)
}

function parseOptions(raw: string): Pick<IncludeSpec, 'limit' | 'offset' | 'filter'> {
  const out: Pick<IncludeSpec, 'limit' | 'offset' | 'filter'> = {}
  for (const part of splitTopLevel(raw, ',')) {
    const idx = part.indexOf(':')
    if (idx === -1) bad(`Invalid include option '${part}'`)
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key === 'limit' || key === 'offset') {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 0) bad(`Include option '${key}' must be a non-negative integer`)
      out[key] = n
    }
    else if (key === 'filter') {
      try {
        // Accept both JSON and the unquoted-key shorthand `{approved:true}`.
        out.filter = JSON.parse(value.replace(/([{,]\s*)([a-z_$][\w$]*)\s*:/gi, '$1"$2":'))
      }
      catch {
        bad('Include filter is not valid JSON')
      }
    }
    else {
      bad(`Unknown include option '${key}'`)
    }
  }
  return out
}

/** Parse one dot-path segment: `name[f1,f2]{opts}`. */
function parseSegment(segment: string): Omit<IncludeSpec, 'children'> {
  const match = /^([a-z_$][\w$]*)(\[[^\]]*\])?(\{.*\})?$/i.exec(segment.trim())
  if (!match) bad(`Invalid include '${segment}'`)
  const spec: Omit<IncludeSpec, 'children'> = { relation: match[1]! }
  if (match[2]) {
    spec.fields = match[2].slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
    if (spec.fields.length === 0) bad(`Empty field selection in include '${segment}'`)
  }
  if (match[3]) Object.assign(spec, parseOptions(match[3].slice(1, -1)))
  return spec
}

export function parseIncludeParam(include: string | string[] | undefined): IncludeSpec[] {
  if (!include) return []
  const items = (Array.isArray(include) ? include : [include]).flatMap(i => splitTopLevel(String(i), ','))
  const roots: IncludeSpec[] = []

  for (const item of items) {
    let level = roots
    for (const segment of splitTopLevel(item, '.')) {
      const parsed = parseSegment(segment)
      let node = level.find(n => n.relation === parsed.relation)
      if (!node) {
        node = { ...parsed, children: [] }
        level.push(node)
      }
      else {
        Object.assign(node, { ...parsed, relation: node.relation, children: node.children })
      }
      level = node.children
    }
  }
  return roots
}

// ── Resolution against Drizzle's relational metadata ─────────────────────────────────────────────────────

function relationalSchema(db: any): Record<string, any> | undefined {
  return db?._?.schema
}

/** Drizzle export name (`db.query` key) of a table object. */
function queryKeyOf(db: any, table: any): string | undefined {
  const full = db?._?.fullSchema ?? {}
  for (const [key, value] of Object.entries(full)) if (value === table) return key
  const schema = relationalSchema(db) ?? {}
  const name = getTableName(table)
  for (const [key, value] of Object.entries(schema)) if ((value as any)?.dbName === name) return key
  return undefined
}

function resourceOfTable(context: HandlerContext, table: any): string | undefined {
  const registry = context.registry ?? {}
  for (const [name, reg] of Object.entries(registry)) if ((reg as any)?.schema === table) return name
  const dbName = getTableName(table)
  for (const [name, reg] of Object.entries(registry)) {
    const t = (reg as any)?.schema
    if (t && getTableName(t) === dbName) return name
  }
  return undefined
}

function relationsConfig(context: HandlerContext) {
  const r = (context.runtimeConfig as any)?.autoApi?.relations ?? {}
  return {
    maxDepth: r.maxDepth ?? 3,
    maxIncludes: r.maxIncludes ?? 20,
    maxLimit: (context.runtimeConfig as any)?.autoApi?.pagination?.maxLimit ?? 100,
    allowFieldSelection: r.allowFieldSelection !== false,
    allowFiltering: r.allowFiltering !== false,
    allowPagination: r.allowPagination !== false,
  }
}

async function allowedColumns(context: HandlerContext, node: Pick<IncludeNode, 'resource' | 'scopeName' | 'table'>): Promise<Set<string>> {
  if (node.resource) return readableColumns(context, node.resource, node.table)
  const hidden = hiddenFieldsOf(context, node.scopeName)
  return new Set(Object.keys(getColumns(node.table)).filter(k => !hidden.has(k)))
}

/** Columns a row must carry to be authorized after the fetch. */
function authColumns(context: HandlerContext, table: any): string[] {
  const columns = getColumns(table)
  const keys = [primaryKeyName(table)]
  const softCol = getSoftDeleteColumn(table)
  if (softCol) keys.push(softCol)
  const tenantKey = context.tenant?.field ?? tenantField(getTenancyConfig(context))
  if (tenantKey in columns) keys.push(tenantKey)
  return keys.filter(k => k in columns)
}

/**
 * Validate and authorize `?include=` for `resource`, and build the Drizzle `with` config. Throws 400 for
 * unknown relations / fields / options and 403 for a relation whose resource the caller may not read.
 */
export async function planIncludes(
  context: HandlerContext,
  resource: string,
  include: string | string[] | undefined,
): Promise<IncludePlan | undefined> {
  const specs = parseIncludeParam(include)
  if (specs.length === 0) return undefined

  const db = context.db
  const schema = relationalSchema(db)
  const rootTable = context.schema?.[resource]
  const queryKey = db?.query?.[resource] ? resource : queryKeyOf(db, rootTable)
  if (!schema || !queryKey || !db.query?.[queryKey]) {
    bad(`Relations are not available for '${resource}' — pass the schema (with relations) to drizzle()`, 500)
  }

  const cfg = relationsConfig(context)
  let count = 0

  const resolve = async (parentKey: string, list: IncludeSpec[], depth: number, prefix: string): Promise<IncludeNode[]> => {
    const nodes: IncludeNode[] = []
    for (const spec of list) {
      const path = prefix ? `${prefix}.${spec.relation}` : spec.relation
      if (depth > cfg.maxDepth) bad(`Include '${path}' is nested deeper than ${cfg.maxDepth}`)
      if (++count > cfg.maxIncludes) bad(`At most ${cfg.maxIncludes} relations can be included`)

      const relation = schema![parentKey]?.relations?.[spec.relation]
      if (!relation) bad(`Unknown relation '${path}'`)
      const table = relation.referencedTable
      const many = is(relation, Many)
      const targetKey = queryKeyOf(db, table) ?? getTableName(table)
      const targetResource = resourceOfTable(context, table)

      if (targetResource) {
        const allowed = await checkPermission('read', getAuthConfig(context, targetResource), contextFor(context, targetResource))
        if (!allowed) bad(`Not allowed to include '${path}'`, context.user ? 403 : 401)
      }

      const node: IncludeNode = {
        spec,
        path,
        many,
        table,
        resource: targetResource,
        scopeName: targetResource ?? targetKey,
        extraColumns: [],
        children: [],
      }

      const allowed = await allowedColumns(context, node)
      if (spec.fields) {
        if (!cfg.allowFieldSelection) bad('Field selection on relations is disabled')
        for (const f of spec.fields) if (!allowed.has(f)) bad(`Unknown field '${f}' in include '${path}'`)
      }
      if (spec.filter) {
        if (!cfg.allowFiltering) bad('Filtering on relations is disabled')
        if (!many) bad(`Include '${path}' is a to-one relation — only to-many relations can be filtered`)
        // Validate now so a bad field is a 400 before any query runs.
        buildWhereClause(spec.filter, table, allowed)
      }
      if (spec.limit !== undefined || spec.offset !== undefined) {
        if (!cfg.allowPagination) bad('Pagination on relations is disabled')
        if (!many) bad(`Include '${path}' is a to-one relation — only to-many relations can be paginated`)
        if ((spec.limit ?? 0) > cfg.maxLimit) bad(`Include '${path}' limit exceeds ${cfg.maxLimit}`)
      }

      node.children = await resolve(targetKey, spec.children, depth + 1, path)
      ;(node as any).allowed = allowed
      nodes.push(node)
    }
    return nodes
  }

  const nodes = await resolve(queryKey, specs, 1, '')

  const toWith = (list: IncludeNode[]): Record<string, any> => {
    const out: Record<string, any> = {}
    for (const node of list) {
      const cfgNode: Record<string, any> = {}
      if (node.spec.fields) {
        const required = authColumns(context, node.table)
        node.extraColumns = required.filter(k => !node.spec.fields!.includes(k))
        cfgNode.columns = Object.fromEntries([...node.spec.fields, ...node.extraColumns].map(k => [k, true]))
      }
      if (node.spec.filter) {
        const filter = node.spec.filter
        const allowed: Set<string> = (node as any).allowed
        cfgNode.where = (fields: any) => buildWhereClause(filter, fields, allowed)
      }
      if (node.spec.limit !== undefined) cfgNode.limit = node.spec.limit
      if (node.spec.offset !== undefined) cfgNode.offset = node.spec.offset
      if (node.children.length) cfgNode.with = toWith(node.children)
      out[node.spec.relation] = Object.keys(cfgNode).length ? cfgNode : true
    }
    return out
  }

  return { with: toWith(nodes), nodes, queryKey }
}

// ── Post-fetch authorization of included rows ────────────────────────────────────────────────────────────

async function visibleIds(context: HandlerContext, node: IncludeNode, rows: any[]): Promise<Set<string> | undefined> {
  if (!node.resource) return undefined
  const scope = rowScope(context, node.resource, node.table)
  if (!scope) return undefined
  const pk = primaryKeyName(node.table)
  const ids = [...new Set(rows.map(r => r?.[pk]).filter(v => v !== undefined && v !== null))]
  if (ids.length === 0) return new Set()
  const found = await selectInChunks(ids, part => context.db
    .select({ id: primaryKeyColumn(node.table) })
    .from(node.table)
    .where(and(inArray(primaryKeyColumn(node.table), part), scope)))
  return new Set(found.map(r => String(r.id)))
}

async function deniedReadFields(context: HandlerContext, resource: string | undefined): Promise<string[]> {
  if (!resource) return []
  const auth = getAuthConfig(context, resource)
  if (!auth?.fields) return []
  const target = contextFor(context, resource)
  const denied: string[] = []
  for (const [name, rule] of Object.entries(auth.fields)) {
    if (rule?.read !== undefined && !(await checkFieldPermission(name, 'read', auth, target))) denied.push(name)
  }
  return denied
}

/**
 * Drop included rows the caller may not see, strip columns they may not read, and remove the columns that
 * were only fetched for this check. Mutates and returns `data` (a row or an array of rows).
 */
export async function authorizeIncluded<T>(context: HandlerContext, data: T, plan: IncludePlan | undefined): Promise<T> {
  if (!plan || !data) return data
  const parents = (Array.isArray(data) ? data : [data]).filter(Boolean)
  await authorizeLevel(context, parents, plan.nodes)
  return data
}

async function authorizeLevel(context: HandlerContext, parents: any[], nodes: IncludeNode[]): Promise<void> {
  for (const node of nodes) {
    const key = node.spec.relation
    const rows: any[] = []
    for (const parent of parents) {
      const value = parent?.[key]
      if (Array.isArray(value)) rows.push(...value)
      else if (value) rows.push(value)
    }

    const softCol = getSoftDeleteColumn(node.table)
    const pk = primaryKeyName(node.table)
    const scoped = await visibleIds(context, node, rows)
    const keep = new Set<any>()
    for (const row of rows) {
      if (scoped) {
        if (!scoped.has(String(row?.[pk]))) continue
      }
      else {
        if (softCol && row?.[softCol] != null) continue
        if (!rowInTenant(context, node.scopeName, node.table, row)) continue
      }
      if (node.resource && !(await passesObjectLevel(context, node.resource, row))) continue
      keep.add(row)
    }

    const strip = [...node.extraColumns, ...(await deniedReadFields(context, node.resource))]
    const survivors: any[] = []
    for (const parent of parents) {
      if (!parent || !(key in parent)) continue
      const value = parent[key]
      if (Array.isArray(value)) parent[key] = value.filter(r => keep.has(r))
      else if (value && !keep.has(value)) parent[key] = null
      const kept = Array.isArray(parent[key]) ? parent[key] : parent[key] ? [parent[key]] : []
      for (const row of kept) {
        for (const f of strip) Reflect.deleteProperty(row, f)
        survivors.push(row)
      }
    }

    if (node.children.length) await authorizeLevel(context, survivors, node.children)
  }
}
