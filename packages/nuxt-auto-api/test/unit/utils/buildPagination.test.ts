import { describe, it, expect } from 'vitest'
import { buildPagination } from '../../../src/runtime/server/utils/buildPagination'

describe('buildPagination', () => {
  it('should use default limit', () => {
    const result = buildPagination({}, { defaultLimit: 20, maxLimit: 100 })

    expect(result.limit).toBe(20)
    expect(result.offset).toBeUndefined()
  })

  it('should use custom limit', () => {
    const result = buildPagination(
      { limit: 10 },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.limit).toBe(10)
  })

  it('should calculate offset from page', () => {
    const result = buildPagination(
      { page: 3, limit: 10 },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.limit).toBe(10)
    expect(result.offset).toBe(20) // (3-1) * 10
  })

  it('should enforce max limit', () => {
    const result = buildPagination(
      { limit: 500 },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.limit).toBe(100)
  })

  it('should handle negative limit', () => {
    const result = buildPagination(
      { limit: -5 },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.limit).toBe(20) // Falls back to default
  })

  it('should handle zero limit', () => {
    const result = buildPagination(
      { limit: 0 },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.limit).toBe(20) // Falls back to default
  })

  it('should handle cursor-based pagination', () => {
    const result = buildPagination(
      { cursor: 'eyJpZCI6MTAwfQ==', limit: 20 },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.cursor).toBe('eyJpZCI6MTAwfQ==')
    expect(result.limit).toBe(20)
  })

  it('should handle page 1', () => {
    const result = buildPagination(
      { page: 1, limit: 10 },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.offset).toBe(0)
  })

  it('should handle page 0 as page 1', () => {
    const result = buildPagination(
      { page: 0, limit: 10 },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.offset).toBe(0)
  })

  it('should handle negative page as page 1', () => {
    const result = buildPagination(
      { page: -5, limit: 10 },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.offset).toBe(0)
  })

  it('should use default options when not provided', () => {
    const result = buildPagination({})

    expect(result.limit).toBe(20) // Default defaultLimit
  })

  it('should parse string limit', () => {
    const result = buildPagination(
      { limit: '15' as any },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.limit).toBe(15)
  })

  it('should parse string page', () => {
    const result = buildPagination(
      { page: '2' as any, limit: 10 },
      { defaultLimit: 20, maxLimit: 100 }
    )

    expect(result.offset).toBe(10)
  })
})
