import { describe, it, expect } from 'vitest'
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { dateBucketExpression, parseGroupBy } from '../../../src/runtime/server/utils/buildAggregation'

const orders = sqliteTable('orders', { id: integer('id').primaryKey(), status: text('status'), total: integer('total') })

describe('parseGroupBy', () => {
  it('reads a column and a date bucket', () => {
    expect(parseGroupBy('status')).toEqual({ field: 'status', key: 'status' })
    expect(parseGroupBy('createdAt:month')).toEqual({ field: 'createdAt', bucket: 'month', key: 'createdAt_month' })
  })

  it('refuses an unknown bucket', () => {
    expect(() => parseGroupBy('createdAt:decade')).toThrow(/Invalid groupBy/)
    expect(() => parseGroupBy('createdAt:month:x')).toThrow(/Invalid groupBy/)
  })
})

describe('dateBucketExpression', () => {
  it('refuses a column that holds no dates', () => {
    expect(() => dateBucketExpression(orders.total, 'month', 'total')).toThrow(/needs a date or timestamp column/)
  })
})
