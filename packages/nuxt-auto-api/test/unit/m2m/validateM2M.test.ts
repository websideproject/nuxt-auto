import { describe, it, expect } from 'vitest'
import {
  validateM2MSyncRequest,
  validateM2MAddRequest,
  validateM2MRemoveRequest,
  validateMetadata,
  validateResourceExists,
  validateIdsNotEmpty,
  validateBatchSize,
  sanitizeIds,
} from '../../../src/runtime/server/utils/m2m/validateM2M'

describe('validateM2MSyncRequest', () => {
  it('should validate valid sync request', () => {
    const body = {
      ids: [1, 2, 3],
      metadata: [
        { sortOrder: 1 },
        { sortOrder: 2 },
        { sortOrder: 3 },
      ],
    }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(true)
    expect(result.data).toEqual({
      ids: [1, 2, 3],
      metadata: [
        { sortOrder: 1 },
        { sortOrder: 2 },
        { sortOrder: 3 },
      ],
    })
  })

  it('should validate sync request without metadata', () => {
    const body = { ids: [1, 2, 3] }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(true)
    expect(result.data?.ids).toEqual([1, 2, 3])
    expect(result.data?.metadata).toBeUndefined()
  })

  it('should accept empty ids array', () => {
    const body = { ids: [] }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(true)
    expect(result.data?.ids).toEqual([])
  })

  it('should reject non-object body', () => {
    const result = validateM2MSyncRequest('invalid')

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Request body must be an object')
  })

  it('should reject null body', () => {
    const result = validateM2MSyncRequest(null)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Request body must be an object')
  })

  it('should reject missing ids field', () => {
    const body = { metadata: [] }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('ids must be an array')
  })

  it('should reject non-array ids', () => {
    const body = { ids: 'not-an-array' }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('ids must be an array')
  })

  it('should reject invalid ID types', () => {
    const body = { ids: [1, 'two', null, undefined] }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('All IDs must be strings or numbers')
  })

  it('should reject non-array metadata', () => {
    const body = {
      ids: [1, 2],
      metadata: 'not-an-array',
    }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('metadata must be an array')
  })

  it('should reject metadata length mismatch', () => {
    const body = {
      ids: [1, 2, 3],
      metadata: [{ sortOrder: 1 }], // Only 1 metadata item for 3 IDs
    }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('metadata length')
  })

  it('should reject non-object metadata items', () => {
    const body = {
      ids: [1, 2],
      metadata: ['invalid', 'items'],
    }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('All metadata items must be objects')
  })

  it('should accept string IDs', () => {
    const body = { ids: ['a', 'b', 'c'] }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(true)
    expect(result.data?.ids).toEqual(['a', 'b', 'c'])
  })

  it('should accept mixed string and number IDs', () => {
    const body = { ids: [1, 'two', 3] }

    const result = validateM2MSyncRequest(body)

    expect(result.valid).toBe(true)
    expect(result.data?.ids).toEqual([1, 'two', 3])
  })
})

describe('validateM2MAddRequest', () => {
  it('should validate valid add request', () => {
    const body = { ids: [4, 5, 6] }

    const result = validateM2MAddRequest(body)

    expect(result.valid).toBe(true)
    expect(result.data?.ids).toEqual([4, 5, 6])
  })

  it('should validate add request with metadata', () => {
    const body = {
      ids: [4, 5],
      metadata: [{ sortOrder: 1 }, { sortOrder: 2 }],
    }

    const result = validateM2MAddRequest(body)

    expect(result.valid).toBe(true)
  })
})

describe('validateM2MRemoveRequest', () => {
  it('should validate valid remove request', () => {
    const body = { ids: [2, 3] }

    const result = validateM2MRemoveRequest(body)

    expect(result.valid).toBe(true)
    expect(result.data?.ids).toEqual([2, 3])
  })

  it('should reject remove request with non-array ids', () => {
    const body = { ids: 'not-an-array' }

    const result = validateM2MRemoveRequest(body)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('ids must be an array')
  })
})

describe('validateMetadata', () => {
  const mockJunction = {
    tableName: 'articleCategories',
    leftResource: 'articles',
    rightResource: 'categories',
    leftKey: 'articleId',
    rightKey: 'categoryId',
    metadataColumns: ['sortOrder', 'isPrimary'],
    table: null,
  }

  it('should validate metadata with valid columns', () => {
    const metadata = [
      { sortOrder: 1 },
      { sortOrder: 2, isPrimary: true },
    ]

    expect(() => {
      validateMetadata(metadata, mockJunction)
    }).not.toThrow()
  })

  it('should allow undefined metadata', () => {
    expect(() => {
      validateMetadata(undefined, mockJunction)
    }).not.toThrow()
  })

  it('should allow empty metadata array', () => {
    expect(() => {
      validateMetadata([], mockJunction)
    }).not.toThrow()
  })

  it('should throw error for invalid metadata columns', () => {
    const metadata = [{ invalidColumn: 'value' }]

    expect(() => {
      validateMetadata(metadata, mockJunction)
    }).toThrow(/Invalid metadata columns/)
  })

  it('should throw error if junction has no metadata columns', () => {
    const noMetaJunction = {
      ...mockJunction,
      metadataColumns: [],
    }
    const metadata = [{ sortOrder: 1 }]

    expect(() => {
      validateMetadata(metadata, noMetaJunction)
    }).toThrow(/has no metadata columns/)
  })
})

describe('validateResourceExists', () => {
  const schema = {
    articles: {},
    categories: {},
  }

  it('should not throw for existing resource', () => {
    expect(() => {
      validateResourceExists(schema, 'articles')
    }).not.toThrow()
  })

  it('should throw error for non-existent resource', () => {
    expect(() => {
      validateResourceExists(schema, 'nonexistent')
    }).toThrow('Resource nonexistent not found in schema')
  })
})

describe('validateIdsNotEmpty', () => {
  it('should not throw for non-empty array', () => {
    expect(() => {
      validateIdsNotEmpty([1, 2, 3])
    }).not.toThrow()
  })

  it('should throw error for empty array', () => {
    expect(() => {
      validateIdsNotEmpty([])
    }).toThrow('ids array cannot be empty')
  })
})

describe('validateBatchSize', () => {
  it('should not throw for batch within limit', () => {
    const ids = Array.from({ length: 100 }, (_, i) => i)

    expect(() => {
      validateBatchSize(ids, 500)
    }).not.toThrow()
  })

  it('should throw error for batch exceeding limit', () => {
    const ids = Array.from({ length: 600 }, (_, i) => i)

    expect(() => {
      validateBatchSize(ids, 500)
    }).toThrow(/Batch size 600 exceeds maximum of 500/)
  })

  it('should use default max size of 500', () => {
    const ids = Array.from({ length: 501 }, (_, i) => i)

    expect(() => {
      validateBatchSize(ids)
    }).toThrow(/exceeds maximum of 500/)
  })
})

describe('sanitizeIds', () => {
  it('should convert numeric strings to numbers', () => {
    const ids = ['1', '2', '3']

    const result = sanitizeIds(ids)

    expect(result).toEqual([1, 2, 3])
  })

  it('should keep non-numeric strings as strings', () => {
    const ids = ['a', 'b', 'c']

    const result = sanitizeIds(ids)

    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('should keep numbers as numbers', () => {
    const ids = [1, 2, 3]

    const result = sanitizeIds(ids)

    expect(result).toEqual([1, 2, 3])
  })

  it('should handle mixed types', () => {
    const ids = [1, '2', 'three', '4']

    const result = sanitizeIds(ids)

    expect(result).toEqual([1, 2, 'three', 4])
  })

  it('should not convert decimal strings', () => {
    const ids = ['1.5', '2.7']

    const result = sanitizeIds(ids)

    expect(result).toEqual(['1.5', '2.7'])
  })
})
