import { eq, and, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import type { HandlerContext, BulkOperationResponse } from '../../types'
import { checkObjectLevelAuth } from '../middleware/authz'
import { getSoftDeleteColumn } from '../utils/softDelete'
import { buildTenantWhere } from '../utils/tenant'
import { executeBeforeHook, executeAfterHook } from '../utils/executeHooks'
import { filterHiddenFields } from '../utils/filterHiddenFields'
import { getDatabaseAdapter } from '../database'

/**
 * Bulk create handler - POST /api/[resource]/bulk
 */
export async function bulkCreateHandler(context: HandlerContext): Promise<BulkOperationResponse> {
  const { db, schema, resource } = context
  const runtimeConfig = useRuntimeConfig?.()
  const maxBatchSize = runtimeConfig?.autoApi?.bulk?.maxBatchSize ?? 100
  const transactional = runtimeConfig?.autoApi?.bulk?.transactional ?? true

  // Get the table from schema
  const table = schema[resource]
  if (!table) {
    throw new Error(`Table ${resource} not found in schema`)
  }

  // Get items from validated body
  const body = context.validated.body
  if (!body || !Array.isArray(body.items)) {
    throw createError({
      statusCode: 400,
      message: 'Request body must contain an "items" array',
    })
  }

  const items = body.items

  // Check batch size limit
  if (items.length > maxBatchSize) {
    throw createError({
      statusCode: 400,
      message: `Batch size exceeds maximum of ${maxBatchSize}`,
    })
  }

  if (items.length === 0) {
    return {
      data: [],
      meta: {
        total: 0,
        successful: 0,
        failed: 0,
      },
    }
  }

  const results: any[] = []
  const errors: Array<{ index: number; error: string }> = []

  // Execute beforeCreate hook for each item
  const processedItems: any[] = []
  for (let i = 0; i < items.length; i++) {
    try {
      let itemData = items[i]

      // Auto-set tenant ID if multi-tenancy is enabled
      if (context.tenant) {
        itemData = { ...itemData, [context.tenant.field]: context.tenant.id }
      }

      // Execute beforeCreate hook
      itemData = await executeBeforeHook('create', context, itemData)
      processedItems.push(itemData)
    } catch (error: any) {
      errors.push({
        index: i,
        error: error.message || 'Validation failed',
      })
    }
  }

  // If any validation failed and we're in transactional mode, abort
  if (errors.length > 0 && transactional) {
    throw createError({
      statusCode: 400,
      message: 'Some items failed validation',
      data: { errors },
    })
  }

  // Insert records
  if (transactional) {
    // Use adapter.atomic() for engine-agnostic transaction
    const adapter = context.adapter || getDatabaseAdapter()
    await adapter.atomic(async ({ tx }) => {
      const created = await tx.insert(table).values(processedItems).returning()
      results.push(...created)

      // Execute afterCreate hooks
      for (const item of created) {
        try {
          await executeAfterHook('create', context, item)
        } catch (error: any) {
          console.error('[autoApi] afterCreate hook error:', error)
        }
      }
    })
  } else {
    // Insert individually, collect errors
    for (let i = 0; i < processedItems.length; i++) {
      try {
        const [created] = await db.insert(table).values(processedItems[i]).returning()
        results.push(created)

        // Execute afterCreate hook
        try {
          await executeAfterHook('create', context, created)
        } catch (error: any) {
          console.error('[autoApi] afterCreate hook error:', error)
        }
      } catch (error: any) {
        errors.push({
          index: i,
          error: error.message || 'Insert failed',
        })
      }
    }
  }

  // Filter hidden fields from all results
  const filteredResults = filterHiddenFields(results, context)

  return {
    data: filteredResults,
    meta: {
      total: items.length,
      successful: results.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  }
}

/**
 * Bulk update handler - PATCH /api/[resource]/bulk
 */
export async function bulkUpdateHandler(context: HandlerContext): Promise<BulkOperationResponse> {
  const { db, schema, resource } = context
  const runtimeConfig = useRuntimeConfig?.()
  const maxBatchSize = runtimeConfig?.autoApi?.bulk?.maxBatchSize ?? 100
  const transactional = runtimeConfig?.autoApi?.bulk?.transactional ?? true

  // Get the table from schema
  const table = schema[resource]
  if (!table) {
    throw new Error(`Table ${resource} not found in schema`)
  }

  // Get items from validated body
  const body = context.validated.body
  if (!body || !Array.isArray(body.items)) {
    throw createError({
      statusCode: 400,
      message: 'Request body must contain an "items" array with {id, data} objects',
    })
  }

  const items = body.items

  // Validate structure
  for (let i = 0; i < items.length; i++) {
    if (!items[i].id || !items[i].data) {
      throw createError({
        statusCode: 400,
        message: `Item at index ${i} must have "id" and "data" properties`,
      })
    }
  }

  // Check batch size limit
  if (items.length > maxBatchSize) {
    throw createError({
      statusCode: 400,
      message: `Batch size exceeds maximum of ${maxBatchSize}`,
    })
  }

  if (items.length === 0) {
    return {
      data: [],
      meta: {
        total: 0,
        successful: 0,
        failed: 0,
      },
    }
  }

  const results: any[] = []
  const errors: Array<{ index: number; id: string | number; error: string }> = []

  const performUpdate = async (tx: any) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const { id, data } = item

      try {
        // Check if record exists (with tenant scoping)
        let whereClause = eq(table.id, id)
        if (context.tenant && !context.tenant.canAccessAllTenants) {
          const tenantWhere = buildTenantWhere(table, context.tenant.id, context.tenant.field)
          whereClause = and(whereClause, tenantWhere)
        }

        const [existing] = await tx.select().from(table).where(whereClause)

        if (!existing) {
          throw new Error(`Record with id ${id} not found`)
        }

        // Check object-level authorization
        await checkObjectLevelAuth(existing, context)

        // Execute beforeUpdate hook
        let processedData = await executeBeforeHook('update', context, data, id)

        // Update the record
        const [updated] = await tx
          .update(table)
          .set({
            ...processedData,
            updatedAt: new Date(),
          })
          .where(eq(table.id, id))
          .returning()

        results.push(updated)

        // Execute afterUpdate hook
        try {
          await executeAfterHook('update', context, updated)
        } catch (error: any) {
          console.error('[autoApi] afterUpdate hook error:', error)
        }
      } catch (error: any) {
        errors.push({
          index: i,
          id,
          error: error.message || 'Update failed',
        })

        // If transactional and error, rollback will happen
        if (transactional) {
          throw error
        }
      }
    }
  }

  if (transactional) {
    try {
      const adapter = context.adapter || getDatabaseAdapter()
      await adapter.atomic(async ({ tx }) => performUpdate(tx))
    } catch (error: any) {
      throw createError({
        statusCode: 400,
        message: 'Bulk update failed (transaction rolled back)',
        data: { errors },
      })
    }
  } else {
    await performUpdate(db)
  }

  // Filter hidden fields from all results
  const filteredResults = filterHiddenFields(results, context)

  return {
    data: filteredResults,
    meta: {
      total: items.length,
      successful: results.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  }
}

/**
 * Bulk delete handler - DELETE /api/[resource]/bulk
 */
export async function bulkDeleteHandler(context: HandlerContext): Promise<BulkOperationResponse> {
  const { db, schema, resource } = context
  const runtimeConfig = useRuntimeConfig?.()
  const maxBatchSize = runtimeConfig?.autoApi?.bulk?.maxBatchSize ?? 100
  const transactional = runtimeConfig?.autoApi?.bulk?.transactional ?? true

  // Get the table from schema
  const table = schema[resource]
  if (!table) {
    throw new Error(`Table ${resource} not found in schema`)
  }

  // Get IDs from validated body
  const body = context.validated.body
  if (!body || !Array.isArray(body.ids)) {
    throw createError({
      statusCode: 400,
      message: 'Request body must contain an "ids" array',
    })
  }

  const ids = body.ids

  // Check batch size limit
  if (ids.length > maxBatchSize) {
    throw createError({
      statusCode: 400,
      message: `Batch size exceeds maximum of ${maxBatchSize}`,
    })
  }

  if (ids.length === 0) {
    return {
      data: [],
      meta: {
        total: 0,
        successful: 0,
        failed: 0,
      },
    }
  }

  const softDeleteCol = getSoftDeleteColumn(table)
  const results: any[] = []
  const errors: Array<{ index: number; id: string | number; error: string }> = []

  const performDelete = async (tx: any) => {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]

      try {
        // Check if record exists (with tenant scoping)
        let whereClause = eq(table.id, id)
        if (context.tenant && !context.tenant.canAccessAllTenants) {
          const tenantWhere = buildTenantWhere(table, context.tenant.id, context.tenant.field)
          whereClause = and(whereClause, tenantWhere)
        }

        const [existing] = await tx.select().from(table).where(whereClause)

        if (!existing) {
          throw new Error(`Record with id ${id} not found`)
        }

        // Check object-level authorization
        await checkObjectLevelAuth(existing, context)

        // Execute beforeDelete hook
        await executeBeforeHook('delete', context, undefined, id)

        // Perform delete (soft or hard)
        if (softDeleteCol) {
          await tx.update(table)
            .set({ [softDeleteCol]: new Date() })
            .where(eq(table.id, id))
        } else {
          await tx.delete(table).where(eq(table.id, id))
        }

        results.push({ id, deleted: true })

        // Execute afterDelete hook
        try {
          await executeAfterHook('delete', context, undefined, id)
        } catch (error: any) {
          console.error('[autoApi] afterDelete hook error:', error)
        }
      } catch (error: any) {
        errors.push({
          index: i,
          id,
          error: error.message || 'Delete failed',
        })

        // If transactional and error, rollback will happen
        if (transactional) {
          throw error
        }
      }
    }
  }

  if (transactional) {
    try {
      const adapter = context.adapter || getDatabaseAdapter()
      await adapter.atomic(async ({ tx }) => performDelete(tx))
    } catch (error: any) {
      throw createError({
        statusCode: 400,
        message: 'Bulk delete failed (transaction rolled back)',
        data: { errors },
      })
    }
  } else {
    await performDelete(db)
  }

  return {
    data: results,
    meta: {
      total: ids.length,
      successful: results.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  }
}
