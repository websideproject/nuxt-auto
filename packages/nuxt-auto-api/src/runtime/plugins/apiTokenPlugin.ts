import { createHash, randomBytes } from 'node:crypto'
import { createError, defineEventHandler, getHeader } from 'h3'
import { eq } from 'drizzle-orm'
import { defineAutoApiPlugin } from '../types/plugin'
import type { AutoApiPlugin } from '../types/plugin'
import type { AuthUser, HandlerContext } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiTokenResourceConfig {
  /** Column that stores the hashed secret. @default 'key' */
  secretField?: string
  /** Foreign key linking to the user who owns this token. */
  userRelation: {
    /** FK column name on the token table. @default 'userId' */
    field?: string
    /** User resource/table name. @default 'users' */
    resource?: string
  }
  /** Column for organization/team scoping (team tokens). */
  orgField?: string
  /** JSON array column for scopes (e.g. `["articles:read"]`). */
  scopeField?: string
  /** Timestamp column for token expiry. */
  expiresField?: string
  /** Timestamp column auto-updated on each auth. */
  lastUsedField?: string
  /** Whether tokens from this table can authenticate requests. @default true */
  authEnabled?: boolean
}

export interface ApiTokenPluginOptions {
  /** Token tables and their config. */
  resources: Record<string, ApiTokenResourceConfig>

  /** Authentication header configuration. */
  auth?: {
    /** Enable Bearer token auth. @default true */
    enabled?: boolean
    /** HTTP header to read. @default 'Authorization' */
    header?: string
    /** Header value prefix. @default 'Bearer' */
    prefix?: string
    /** Prefix prepended to generated tokens (e.g. `'sk_'`). */
    tokenPrefix?: string
  }

  /** Hash algorithm. @default 'sha256' */
  hashAlgorithm?: 'sha256' | 'sha512'
  /** Random bytes in generated tokens. @default 32 */
  tokenLength?: number

  /** In-memory token cache config. */
  cache?: {
    /** @default true */
    enabled?: boolean
    /** Time-to-live in ms. @default 300_000 (5 min) */
    ttlMs?: number
    /** Max cached entries. @default 1000 */
    maxEntries?: number
  }

  /** Debounce window for `lastUsedAt` writes. @default 60_000 (1 min) */
  lastUsedDebounceMs?: number
  /** Map a DB user row to `AuthUser`. */
  mapUser?: (dbRow: any) => AuthUser
  /** Extract permission strings from a user row. */
  getPermissions?: (dbRow: any) => string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashToken(raw: string, algorithm: string): string {
  return createHash(algorithm).update(raw).digest('hex')
}

function generateRawToken(prefix: string, length: number): string {
  return prefix + randomBytes(length).toString('hex')
}

function maskToken(raw: string, visibleEnd = 4): string {
  if (raw.length <= visibleEnd) return raw
  return raw.slice(0, raw.indexOf('_') + 1 || 0) + '...' + raw.slice(-visibleEnd)
}

function parseScopes(value: unknown): string[] | null {
  if (value == null) return null
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return null }
  }
  return null
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CachedToken {
  hash: string
  resource: string
  recordId: string | number
  user: AuthUser
  permissions: string[]
  scopes: string[] | null
  orgId: string | number | null
  expiresAt: Date | null
  cachedAt: number
}

class TokenCache {
  private byHash = new Map<string, CachedToken>()
  private byRecordKey = new Map<string, string>() // "resource:id" → hash
  private ttlMs: number
  private maxEntries: number
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(ttlMs: number, maxEntries: number) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
    this.cleanupTimer = setInterval(() => this.cleanup(), ttlMs).unref()
  }

  get(hash: string): CachedToken | null {
    const entry = this.byHash.get(hash)
    if (!entry) return null
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.deleteByHash(hash)
      return null
    }
    return entry
  }

  set(entry: CachedToken): void {
    // Evict oldest if over limit (Map keeps insertion order)
    if (this.byHash.size >= this.maxEntries) {
      const oldest = this.byHash.keys().next().value
      if (oldest) this.deleteByHash(oldest)
    }
    this.byHash.set(entry.hash, entry)
    this.byRecordKey.set(`${entry.resource}:${entry.recordId}`, entry.hash)
  }

  invalidateByRecord(resource: string, id: string | number): void {
    const key = `${resource}:${id}`
    const hash = this.byRecordKey.get(key)
    if (hash) this.deleteByHash(hash)
  }

  private deleteByHash(hash: string): void {
    const entry = this.byHash.get(hash)
    if (entry) {
      this.byRecordKey.delete(`${entry.resource}:${entry.recordId}`)
    }
    this.byHash.delete(hash)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [hash, entry] of this.byHash) {
      if (now - entry.cachedAt > this.ttlMs) {
        this.deleteByHash(hash)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Create a full API token management + authentication plugin.
 *
 * Features:
 * - SHA-256/512 token hashing on create, one-time raw token reveal
 * - Bearer token authentication via context extender
 * - Scope enforcement (resource:operation) via pre-auth middleware
 * - Token rotation (`{ _rotate: true }` on update)
 * - Expiry, lastUsedAt tracking, in-memory cache
 * - Organization/team token support (sets context.tenant)
 * - Introspection endpoint (`GET /api/_token/introspect`)
 *
 * @example
 * ```ts
 * createApiTokenPlugin({
 *   resources: {
 *     apiKeys: {
 *       userRelation: { field: 'userId', resource: 'users' },
 *       scopeField: 'scopes',
 *       expiresField: 'expiresAt',
 *       lastUsedField: 'lastUsedAt',
 *     },
 *   },
 *   auth: { tokenPrefix: 'sk_' },
 * })
 * ```
 */
export function createApiTokenPlugin(options: ApiTokenPluginOptions): AutoApiPlugin {
  const {
    resources,
    hashAlgorithm = 'sha256',
    tokenLength = 32,
    lastUsedDebounceMs = 60_000,
    mapUser,
    getPermissions,
  } = options

  const authEnabled = options.auth?.enabled !== false
  const authHeader = options.auth?.header ?? 'Authorization'
  const authPrefix = options.auth?.prefix ?? 'Bearer'
  const tokenPrefix = options.auth?.tokenPrefix ?? ''

  const cacheEnabled = options.cache?.enabled !== false
  const cacheTtlMs = options.cache?.ttlMs ?? 300_000
  const cacheMaxEntries = options.cache?.maxEntries ?? 1_000

  const resourceNames = Object.keys(resources)

  function cfg(resource: string): ApiTokenResourceConfig & { secretField: string; userField: string; userResource: string } {
    const r = resources[resource]!
    return {
      ...r,
      secretField: r.secretField ?? 'key',
      userField: r.userRelation.field ?? 'userId',
      userResource: r.userRelation.resource ?? 'users',
    }
  }

  return defineAutoApiPlugin({
    name: 'api-token',
    version: '2.0.0',

    // -------------------------------------------------------------------
    // Build-time: register introspection endpoint
    // -------------------------------------------------------------------
    buildSetup(ctx) {
      ctx.addServerHandler({
        route: '/api/_token/introspect',
        method: 'get',
        handler: defineEventHandler(async (event) => {
          const { registry } = await (import('#nuxt-auto-api-registry') as any)
          const { getDatabaseAdapter } = await import('../server/database')
          const { getContextExtenders } = await import('../server/plugins/pluginRegistry')

          const adapter = getDatabaseAdapter()
          const db = adapter.db
          const schema: Record<string, any> = {}
          for (const [name, config] of Object.entries(registry)) {
            schema[name] = (config as any).schema
          }

          // Build minimal context for token auth
          const user = (event.context as any).user || null
          const permissions = (event.context as any).permissions || user?.permissions || []
          const context: any = {
            db,
            adapter,
            schema,
            user,
            permissions,
            params: {},
            query: {},
            validated: {},
            event,
            resource: '_token',
            operation: 'get',
          }

          // Run context extenders (token auth will populate context.user)
          const extenders = getContextExtenders()
          for (const extender of extenders) {
            await extender(context)
          }

          // Delegate to the runtime handler stored on globalThis
          const handler = (globalThis as any).__apiTokenIntrospect
          if (!handler) {
            throw createError({ statusCode: 500, message: 'API token plugin not initialized' })
          }

          return await handler(context)
        }),
      })
      ctx.logger.info('Registered GET /api/_token/introspect')
    },

    // -------------------------------------------------------------------
    // Runtime setup
    // -------------------------------------------------------------------
    runtimeSetup(ctx) {
      // Token cache
      const cache = cacheEnabled ? new TokenCache(cacheTtlMs, cacheMaxEntries) : null

      // Debounce tracker for lastUsedAt writes
      const lastUsedTimestamps = new Map<string, number>() // "resource:id" → epoch

      // ---------------------------------------------------------------
      // A. Context extender — Bearer token authentication
      // ---------------------------------------------------------------
      if (authEnabled) {
        ctx.extendContext(async (context: HandlerContext) => {
          // Read Authorization header
          const headerValue = getHeader(context.event, authHeader)
          if (!headerValue) return

          // Parse "Bearer <token>"
          const parts = headerValue.split(' ')
          if (parts.length !== 2 || parts[0] !== authPrefix) return
          const rawToken = parts[1]!

          // Validate token prefix if configured
          if (tokenPrefix && !rawToken.startsWith(tokenPrefix)) return

          // If we have a Bearer token with our prefix, always use token auth
          // (override any session-based user that was set by a Nitro plugin)
          if (context.user) {
            console.log(`[api-token] Bearer token present — overriding session user (${context.user.email || context.user.id})`)
          }

          // Hash the raw token
          const hashed = hashToken(rawToken, hashAlgorithm)

          console.log(`[api-token] Looking up token hash for ${rawToken.slice(0, 10)}...`)

          // Check cache first
          if (cache) {
            const cached = cache.get(hashed)
            if (cached) {
              // Check expiry
              if (cached.expiresAt && cached.expiresAt.getTime() < Date.now()) {
                console.log('[api-token] Cached token expired')
                return
              }

              console.log(`[api-token] Cache hit — user=${cached.user.email || cached.user.id} scopes=${JSON.stringify(cached.scopes)}`)
              context.user = cached.user
              context.permissions = cached.permissions
              ;(context as any)._tokenScopes = cached.scopes
              context.authMethod = 'api-token'

              // Set tenant for org tokens
              if (cached.orgId != null) {
                const c = cfg(cached.resource)
                const tenantField = context.tenant?.field ?? c.orgField ?? 'organizationId'
                context.tenant = {
                  id: cached.orgId,
                  field: tenantField,
                  canAccessAllTenants: false,
                }
              }

              // Fire-and-forget lastUsedAt update
              updateLastUsed(context, cached.resource, cached.recordId)
              return
            }
          }

          // Query ALL configured token tables for a match
          for (const resName of resourceNames) {
            const c = cfg(resName)
            if (c.authEnabled === false) continue

            const table = context.schema[resName]
            if (!table) {
              console.log(`[api-token] Table "${resName}" not found in schema — skipping`)
              continue
            }

            console.log(`[api-token] Querying "${resName}" table for hash match (field: ${c.secretField})`)
            const [tokenRecord] = await context.db
              .select()
              .from(table)
              .where(eq(table[c.secretField], hashed))

            if (!tokenRecord) {
              console.log(`[api-token] No match in "${resName}"`)
              continue
            }

            console.log(`[api-token] Found token record id=${tokenRecord.id} in "${resName}"`)


            // Check expiry
            if (c.expiresField && tokenRecord[c.expiresField]) {
              const expiresAt = new Date(tokenRecord[c.expiresField])
              if (expiresAt.getTime() < Date.now()) return
            }

            // Load user
            const userTable = context.schema[c.userResource]
            if (!userTable) continue

            const userId = tokenRecord[c.userField]
            const [userRow] = await context.db
              .select()
              .from(userTable)
              .where(eq(userTable.id, userId))

            if (!userRow) continue

            // Map user
            const user: AuthUser = mapUser
              ? mapUser(userRow)
              : {
                  id: userRow.id,
                  email: userRow.email,
                  roles: userRow.roles || (userRow.role ? [userRow.role] : []),
                  permissions: userRow.permissions || [],
                  ...userRow,
                }

            const permissions = getPermissions
              ? getPermissions(userRow)
              : (user.permissions || [])

            const scopes = c.scopeField ? parseScopes(tokenRecord[c.scopeField]) : null
            const orgId = c.orgField ? tokenRecord[c.orgField] ?? null : null
            const expiresAt = c.expiresField && tokenRecord[c.expiresField]
              ? new Date(tokenRecord[c.expiresField])
              : null

            console.log(`[api-token] Authenticated: user=${user.email || user.id} role=${(user as any).role} scopes=${JSON.stringify(scopes)} permissions=${JSON.stringify(permissions)}`)

            context.user = user
            context.permissions = permissions
            ;(context as any)._tokenScopes = scopes
            context.authMethod = 'api-token'

            // Set tenant for org tokens
            if (orgId != null) {
              const tenantField = context.tenant?.field ?? c.orgField ?? 'organizationId'
              context.tenant = {
                id: orgId,
                field: tenantField,
                canAccessAllTenants: false,
              }
            }

            // Cache the result
            if (cache) {
              cache.set({
                hash: hashed,
                resource: resName,
                recordId: tokenRecord.id,
                user,
                permissions,
                scopes,
                orgId,
                expiresAt,
                cachedAt: Date.now(),
              })
            }

            // Fire-and-forget lastUsedAt update
            updateLastUsed(context, resName, tokenRecord.id)
            return
          }

          console.log('[api-token] No matching token found in any configured table')
        })

        ctx.logger.info('Bearer token authentication enabled')
      }

      // ---------------------------------------------------------------
      // B. Pre-auth middleware — Token scope enforcement
      // ---------------------------------------------------------------
      if (authEnabled) {
        ctx.addMiddleware({
          name: 'api-token-scope-check',
          stage: 'pre-auth',
          order: 50,
          handler(context: HandlerContext) {
            const scopes = (context as any)._tokenScopes as string[] | null | undefined
            // Not token auth, or no scopes configured → skip (unrestricted)
            if (!scopes) {
              console.log(`[api-token:scope] No _tokenScopes set — skipping scope check (authMethod=${context.authMethod || 'none'})`)
              return
            }
            // Wildcard → unrestricted
            if (scopes.includes('*')) {
              console.log('[api-token:scope] Wildcard scope (*) — unrestricted')
              return
            }

            // Map operations
            const op = (context.operation === 'list' || context.operation === 'get')
              ? 'read'
              : context.operation

            const resource = context.resource

            // Check if any scope matches
            const allowed = scopes.some(s =>
              s === `${resource}:${op}`
              || s === `${resource}:*`
              || s === `*:${op}`,
            )

            console.log(`[api-token:scope] ${resource}:${op} — scopes=${JSON.stringify(scopes)} — ${allowed ? 'ALLOWED' : 'DENIED'}`)

            if (!allowed) {
              throw createError({
                statusCode: 403,
                message: `Token scope does not allow ${resource}:${op}`,
              })
            }
          },
        })

        ctx.logger.info('Token scope enforcement enabled')
      }

      // ---------------------------------------------------------------
      // C. Per-resource lifecycle hooks
      // ---------------------------------------------------------------
      for (const resName of resourceNames) {
        const c = cfg(resName)

        ctx.addHook(resName, {
          // -- beforeCreate: generate & hash token -----------------------
          beforeCreate(data: any, context: HandlerContext) {
            const rawToken = generateRawToken(tokenPrefix, tokenLength)
            const hashed = hashToken(rawToken, hashAlgorithm)

            // Stash raw value for afterCreate
            ;(context as any)._rawToken = rawToken

            const result: any = { ...data, [c.secretField]: hashed }

            // Auto-set userId from authenticated user
            if (context.user && !data[c.userField]) {
              result[c.userField] = context.user.id
            }

            // Auto-set orgId from tenant
            if (c.orgField && context.tenant && !data[c.orgField]) {
              result[c.orgField] = context.tenant.id
            }

            return result
          },

          // -- afterCreate: reveal raw token once -----------------------
          afterCreate(result: any, context: HandlerContext) {
            const rawToken = (context as any)._rawToken
            if (rawToken) {
              return { ...result, [c.secretField]: rawToken }
            }
            return result
          },

          // -- afterGet: mask the hash ---------------------------------
          afterGet(result: any, _context: HandlerContext) {
            if (!result || !result[c.secretField]) return result
            return { ...result, [c.secretField]: maskToken(result[c.secretField]) }
          },

          // -- afterList: mask the hash --------------------------------
          afterList(results: any[], _context: HandlerContext) {
            if (!results) return results
            return results.map(item => {
              if (!item[c.secretField]) return item
              return { ...item, [c.secretField]: maskToken(item[c.secretField]) }
            })
          },

          // -- beforeUpdate: block secret writes, support rotation ------
          beforeUpdate(_id: string | number, data: any, context: HandlerContext) {
            const updated = { ...data }

            // Handle token rotation
            if (updated._rotate === true) {
              delete updated._rotate
              const rawToken = generateRawToken(tokenPrefix, tokenLength)
              const hashed = hashToken(rawToken, hashAlgorithm)
              updated[c.secretField] = hashed
              ;(context as any)._rawToken = rawToken
            } else {
              // Block direct writes to the secret field
              delete updated[c.secretField]
            }

            return updated
          },

          // -- afterUpdate: reveal new token if rotated -----------------
          afterUpdate(result: any, context: HandlerContext) {
            const rawToken = (context as any)._rawToken
            if (rawToken) {
              // Invalidate cache for this record
              if (cache && result?.id) {
                cache.invalidateByRecord(resName, result.id)
              }
              return { ...result, [c.secretField]: rawToken }
            }
            if (result?.[c.secretField]) {
              return { ...result, [c.secretField]: maskToken(result[c.secretField]) }
            }
            return result
          },

          // -- afterDelete: invalidate cache ----------------------------
          afterDelete(id: string | number, _context: HandlerContext) {
            if (cache) {
              cache.invalidateByRecord(resName, id)
            }
          },
        })
      }

      // ---------------------------------------------------------------
      // D. Introspection endpoint handler (stored on globalThis)
      // ---------------------------------------------------------------
      ;(globalThis as any).__apiTokenIntrospect = async (context: HandlerContext) => {
        if (context.authMethod !== 'api-token') {
          throw createError({ statusCode: 401, message: 'Not authenticated with an API token' })
        }

        // Find which token resource and record this is
        const rawToken = getHeader(context.event, authHeader)?.split(' ')[1]
        if (!rawToken) {
          throw createError({ statusCode: 401, message: 'Missing token' })
        }

        const hashed = hashToken(rawToken, hashAlgorithm)

        for (const resName of resourceNames) {
          const c = cfg(resName)
          if (c.authEnabled === false) continue

          const table = context.schema[resName]
          if (!table) continue

          const [record] = await context.db
            .select()
            .from(table)
            .where(eq(table[c.secretField], hashed))

          if (!record) continue

          const result: Record<string, any> = {
            resource: resName,
            id: record.id,
          }

          // Include non-sensitive fields
          if (record.name) result.name = record.name
          if (c.scopeField && record[c.scopeField]) {
            result.scopes = parseScopes(record[c.scopeField])
          }
          if (c.expiresField && record[c.expiresField]) {
            result.expiresAt = record[c.expiresField]
          }
          if (c.lastUsedField && record[c.lastUsedField]) {
            result.lastUsedAt = record[c.lastUsedField]
          }
          if (c.orgField && record[c.orgField]) {
            result.organizationId = record[c.orgField]
          }

          return { data: result }
        }

        throw createError({ statusCode: 404, message: 'Token record not found' })
      }

      // ---------------------------------------------------------------
      // Helper: debounced lastUsedAt update
      // ---------------------------------------------------------------
      function updateLastUsed(context: HandlerContext, resource: string, recordId: string | number): void {
        const c = cfg(resource)
        if (!c.lastUsedField) return

        const key = `${resource}:${recordId}`
        const lastWrite = lastUsedTimestamps.get(key)
        const now = Date.now()

        if (lastWrite && now - lastWrite < lastUsedDebounceMs) return

        lastUsedTimestamps.set(key, now)

        // Fire-and-forget
        const table = context.schema[resource]
        if (!table) return

        const parsedId = typeof recordId === 'string' && /^\d+$/.test(recordId)
          ? parseInt(recordId, 10)
          : recordId

        context.db
          .update(table)
          .set({ [c.lastUsedField]: new Date() })
          .where(eq(table.id, parsedId))
          .catch(() => {
            // Silently ignore - lastUsedAt is best-effort
          })
      }

      ctx.logger.info(`API token plugin enabled for: ${resourceNames.join(', ')}`)
    },
  })
}
