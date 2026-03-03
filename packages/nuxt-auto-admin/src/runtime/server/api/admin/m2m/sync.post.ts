import { defineEventHandler, readBody, createError } from 'h3'
import { eq, and } from 'drizzle-orm'

/**
 * Sync M2M relationships
 * POST /api/admin/m2m/sync
 *
 * @deprecated This endpoint is deprecated and will be removed in a future version.
 * Please migrate to the new M2M endpoints in nuxt-auto-api:
 *
 * OLD:
 * POST /api/admin/m2m/sync
 * Body: {
 *   junctionTable: 'articleCategories',
 *   leftKey: 'articleId',
 *   rightKey: 'categoryId',
 *   leftId: 10,
 *   rightIds: [1, 2, 3]
 * }
 *
 * NEW:
 * POST /api/{resource}/{id}/relations/{relation}
 * Body: { ids: [1, 2, 3] }
 *
 * Example: POST /api/articles/10/relations/categories
 *
 * Migration guide:
 * - Use `useM2MRelation()` and `useM2MSync()` composables from #nuxt-auto-api
 * - Benefits: Automatic permissions, optimistic updates, better caching, batch operations
 *
 * See: packages/nuxt-auto-api/MIGRATION_M2M_V2.md
 */
export default defineEventHandler(async (event) => {
  // Log deprecation warning (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[nuxt-auto-admin] DEPRECATION WARNING: /api/admin/m2m/sync is deprecated.\n' +
      'Please migrate to the new M2M endpoints: POST /api/{resource}/{id}/relations/{relation}\n' +
      'See MIGRATION_M2M_V2.md for migration guide.'
    )
  }
  const body = await readBody(event)
  const { junctionTable, leftKey, rightKey, leftId, rightIds } = body

  if (!junctionTable || !leftKey || !rightKey || !leftId) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields: junctionTable, leftKey, rightKey, leftId'
    })
  }

  // Get DB from globalThis (same pattern as auto-api)
  const db = (globalThis as any).__autoApiDb
  if (!db) {
    throw createError({
      statusCode: 500,
      message: 'Database not initialized. Make sure to set globalThis.__autoApiDb in a server plugin'
    })
  }

  // Import registry to get schema
  const { registry } = await import('#nuxt-auto-api-registry') as any

  // Get the junction table schema from registry
  const resourceConfig = registry[junctionTable]
  if (!resourceConfig) {
    throw createError({
      statusCode: 404,
      message: `Junction table "${junctionTable}" not found in registry`
    })
  }

  const schema = resourceConfig.schema
  if (!schema) {
    throw createError({
      statusCode: 500,
      message: `Schema not found for junction table "${junctionTable}"`
    })
  }

  try {
    // 1. Get current relations
    const currentRecords = await db
      .select()
      .from(schema)
      .where(eq(schema[leftKey], leftId))

    const currentRightIds = currentRecords.map((r: any) => r[rightKey])

    // 2. Calculate diff
    const newRightIds = Array.isArray(rightIds) ? rightIds : []
    const toAdd = newRightIds.filter((id: any) => !currentRightIds.includes(id))
    const toRemove = currentRightIds.filter((id: any) => !newRightIds.includes(id))

    // 3. Remove old relations
    if (toRemove.length > 0) {
      for (const rightId of toRemove) {
        await db
          .delete(schema)
          .where(
            and(
              eq(schema[leftKey], leftId),
              eq(schema[rightKey], rightId)
            )
          )
      }
    }

    // 4. Add new relations
    if (toAdd.length > 0) {
      for (const rightId of toAdd) {
        await db.insert(schema).values({
          [leftKey]: leftId,
          [rightKey]: rightId
        })
      }
    }

    return {
      success: true,
      added: toAdd.length,
      removed: toRemove.length,
      total: newRightIds.length
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `Failed to sync M2M relations: ${error.message}`
    })
  }
})
