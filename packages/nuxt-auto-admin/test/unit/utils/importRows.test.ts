import { describe, it, expect } from 'vitest'
import { autoMap, cellValue, mapRows, toBatches } from '../../../src/runtime/utils/importRows'
import type { ImportField } from '../../../src/runtime/utils/importRows'
import type { ColumnMetadata } from '../../../src/runtime/types'

const column = (name: string, dataType: string): ColumnMetadata => ({
  name, type: '', dataType, isPrimaryKey: false, isAutoIncrement: false, isNullable: true, isUnique: false,
})

const fields: ImportField[] = [
  { name: 'title', label: 'Title', column: column('title', 'string') },
  { name: 'userId', label: 'User Id', column: column('userId', 'number') },
  { name: 'published', label: 'Published', column: column('published', 'boolean') },
  { name: 'meta', label: 'Meta', column: column('meta', 'json') },
]

describe('autoMap', () => {
  it('matches headers to field names or labels, ignoring case, spaces, _ and -', () => {
    expect(autoMap(['TITLE', 'user_id', 'Published', 'unknown'], fields)).toEqual(['title', 'userId', 'published', null])
    expect(autoMap(['User Id'], fields)).toEqual(['userId'])
  })

  it('maps a field at most once', () => {
    expect(autoMap(['title', 'Title'], fields)).toEqual(['title', null])
  })
})

describe('cellValue', () => {
  it('types numbers, booleans and JSON; leaves what does not parse as text for the API to refuse', () => {
    expect(cellValue('42', fields[1]!.column)).toBe(42)
    expect(cellValue('4x', fields[1]!.column)).toBe('4x')
    expect(cellValue(' ', fields[1]!.column)).toBe(' ')
    expect(cellValue('Yes', fields[2]!.column)).toBe(true)
    expect(cellValue('0', fields[2]!.column)).toBe(false)
    expect(cellValue('perhaps', fields[2]!.column)).toBe('perhaps')
    expect(cellValue('{"a":1}', fields[3]!.column)).toEqual({ a: 1 })
    expect(cellValue('{bad', fields[3]!.column)).toBe('{bad')
    expect(cellValue('=1', fields[0]!.column)).toBe('=1')
  })

  it('leaves an empty cell out, so the column default applies', () => {
    expect(cellValue('', fields[0]!.column)).toBeUndefined()
  })
})

describe('mapRows', () => {
  it('builds one item per row through the mapping, skipping unmapped columns and empty cells', () => {
    expect(mapRows([['Hello', '7', 'extra', 'true'], ['', '8']], ['title', 'userId', null, 'published'], fields)).toEqual([
      { title: 'Hello', userId: 7, published: true },
      { userId: 8 },
    ])
  })
})

describe('toBatches', () => {
  it('splits into batches of at most the API maxBatchSize', () => {
    const items = Array.from({ length: 250 }, (_, i) => i)
    expect(toBatches(items, 100).map(b => b.length)).toEqual([100, 100, 50])
    expect(toBatches([], 100)).toEqual([])
    expect(toBatches([1, 2], 0)).toEqual([[1], [2]])
  })
})
