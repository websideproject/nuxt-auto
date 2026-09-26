import { describe, it, expect } from 'vitest'
import { apiErrorMessage, apiStatus, bulkItemErrors, describeItemError } from '../../../src/runtime/utils/apiErrors'
import { collectRows } from '../../../src/runtime/utils/exportRows'
import { changedFields } from '../../../src/runtime/utils/auditLog'

describe('API errors', () => {
  // What ofetch throws for a transactional bulk 400: the h3 error body in `data`.
  const bulk400 = {
    statusCode: 400,
    message: '[DELETE] "/api/posts/bulk": 400 Bad Request',
    data: { statusCode: 400, message: 'Bulk operation failed (nothing was written)', data: { errors: [{ index: 1, id: 7, error: 'Not found' }] } },
  }

  it('reads the status, the API message and the failing items', () => {
    expect(apiStatus(bulk400)).toBe(400)
    expect(apiStatus({ response: { status: 404 } })).toBe(404)
    expect(apiErrorMessage(bulk400)).toBe('Bulk operation failed (nothing was written)')
    expect(apiErrorMessage(new Error('offline'))).toBe('offline')
    expect(bulkItemErrors(bulk400)).toEqual([{ index: 1, id: 7, error: 'Not found' }])
    expect(bulkItemErrors(new Error('x'))).toEqual([])
  })

  it('reads the request validation issues of a bulk body as item errors', () => {
    const validation400 = {
      statusCode: 400,
      data: {
        message: 'Validation error',
        data: { errors: [
          { code: 'invalid_value', path: ['items', 1, 'status'], message: 'Invalid option' },
          { code: 'too_big', path: ['items'], message: 'Too many items' },
        ] },
      },
    }
    expect(bulkItemErrors(validation400)).toEqual([
      { index: 1, error: 'status: Invalid option' },
      { error: 'items: Too many items' },
    ])
  })

  it('names the item by its position in the whole list', () => {
    expect(describeItemError({ index: 1, id: 7, error: 'Not found' })).toBe('Item 2 (id 7): Not found')
    expect(describeItemError({ index: 0, error: 'Title is required' }, 100, 'Row')).toBe('Row 101: Title is required')
    expect(describeItemError({ error: 'The database rejected this item' })).toBe('The database rejected this item')
  })
})

describe('collectRows', () => {
  const pages = [[1, 2], [3, 4], [5]]
  const fetchPage = async (cursor: string, limit: number) => {
    const i = cursor === '' ? 0 : Number(cursor)
    const data = pages[i]!.slice(0, limit)
    return { data, meta: i + 1 < pages.length ? { nextCursor: String(i + 1) } : {} }
  }

  it('follows nextCursor from an empty first cursor', async () => {
    expect(await collectRows(fetchPage, 2, 100)).toEqual({ rows: [1, 2, 3, 4, 5], truncated: false })
  })

  it('stops at maxRows and says so', async () => {
    expect(await collectRows(fetchPage, 2, 3)).toEqual({ rows: [1, 2, 3], truncated: true })
  })
})

describe('changedFields', () => {
  it('lists the fields an update changed, from JSON text or parsed snapshots', () => {
    expect(changedFields({ operation: 'update', before: '{"a":1,"b":2}', after: { a: 1, b: 3, c: 4 } })).toEqual(['b', 'c'])
  })

  it('is empty for a create or delete, or unreadable snapshots', () => {
    expect(changedFields({ operation: 'create', after: '{"a":1}' })).toEqual([])
    expect(changedFields({ operation: 'update', before: '{bad', after: '{"a":1}' })).toEqual([])
  })
})
