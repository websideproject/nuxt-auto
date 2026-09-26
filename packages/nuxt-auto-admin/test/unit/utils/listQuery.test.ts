import { describe, it, expect } from 'vitest'
import {
  activeFilterCount,
  buildListFilter,
  filterableColumns,
  filterKind,
  parseFilterState,
  searchFieldsOf,
  serializeFilterState,
} from '../../../src/runtime/utils/listQuery'
import type { FilterableColumn } from '../../../src/runtime/utils/listQuery'
import type { ColumnMetadata, ResourceSchema } from '../../../src/runtime/types'

const col = (name: string, over: Partial<ColumnMetadata> = {}): ColumnMetadata => ({
  name,
  type: 'SQLiteText',
  dataType: 'string',
  isPrimaryKey: false,
  isAutoIncrement: false,
  isNullable: true,
  isUnique: false,
  ...over,
})

describe('filterKind', () => {
  it('follows the type the database compares', () => {
    expect(filterKind(col('title'))).toBe('text')
    expect(filterKind(col('title', { type: 'PgVarchar' }))).toBe('text')
    expect(filterKind(col('role', { enumValues: ['user', 'admin'] }))).toBe('enum')
    expect(filterKind(col('published', { type: 'SQLiteBoolean', dataType: 'boolean' }))).toBe('boolean')
    expect(filterKind(col('createdAt', { type: 'SQLiteTimestamp', dataType: 'date' }))).toBe('date')
    expect(filterKind(col('views', { type: 'SQLiteInteger', dataType: 'number' }))).toBe('number')
    expect(filterKind(col('price', { type: 'PgNumeric', dataType: 'string' }))).toBe('number')
  })

  it('leaves out what a filter cannot match (JSON, UUID, blobs)', () => {
    expect(filterKind(col('meta', { type: 'SQLiteTextJson', dataType: 'json' }))).toBeNull()
    expect(filterKind(col('uid', { type: 'PgUUID', dataType: 'string' }))).toBeNull()
    expect(filterKind(col('blob', { type: 'SQLiteBlobBuffer', dataType: 'buffer' }))).toBeNull()
  })
})

describe('filterableColumns', () => {
  const resource = {
    listFields: ['id', 'title', 'secret', 'notes', 'meta', 'missing', 'role'],
    hiddenFields: ['secret'],
    columns: [
      col('id', { type: 'SQLiteInteger', dataType: 'number', isPrimaryKey: true }),
      col('title'),
      col('secret'),
      col('notes'),
      col('body'),
      col('meta', { dataType: 'json' }),
      col('role', { enumValues: ['user', 'admin'] }),
    ],
  } as unknown as ResourceSchema

  it('offers the listed, readable columns only — the API 400s on any other', () => {
    expect(filterableColumns(resource, { notes: { canRead: false } })).toEqual([
      { name: 'id', kind: 'number' },
      { name: 'title', kind: 'text' },
      { name: 'role', kind: 'enum', enumValues: ['user', 'admin'] },
    ])
  })
})

describe('buildListFilter', () => {
  const columns: FilterableColumn[] = [
    { name: 'title', kind: 'text' },
    { name: 'body', kind: 'text' },
    { name: 'role', kind: 'enum', enumValues: ['user', 'admin'] },
    { name: 'published', kind: 'boolean' },
    { name: 'views', kind: 'number' },
    { name: 'createdAt', kind: 'date' },
  ]

  it('is undefined when nothing is set', () => {
    expect(buildListFilter({ columns })).toBeUndefined()
    expect(buildListFilter({ columns, filters: { title: '', views: { min: '', max: '' } }, search: '   ', searchFields: ['title'] })).toBeUndefined()
  })

  it('maps each kind to its operator', () => {
    expect(buildListFilter({
      columns,
      filters: { title: 'nuxt', role: 'admin', published: 'false', views: { min: '10', max: '20' } },
    })).toEqual({
      title: { $like: 'nuxt' },
      role: { $eq: 'admin' },
      published: { $eq: false },
      views: { $gte: 10, $lte: 20 },
    })
  })

  it('takes open ranges and ignores values that do not parse', () => {
    expect(buildListFilter({ columns, filters: { views: { min: '0' } } })).toEqual({ views: { $gte: 0 } })
    expect(buildListFilter({ columns, filters: { views: { max: 'abc' } } })).toBeUndefined()
    expect(buildListFilter({ columns, filters: { published: 'maybe' } })).toBeUndefined()
    expect(buildListFilter({ columns, filters: { createdAt: { min: '2026-13-45x' } } })).toBeUndefined()
  })

  it('sends a date range as the whole days, in the browser time zone', () => {
    const f = buildListFilter({ columns, filters: { createdAt: { min: '2026-03-01', max: '2026-03-31' } } }) as any
    expect(f.createdAt.$gte).toBe(new Date('2026-03-01T00:00:00.000').toISOString())
    expect(f.createdAt.$lte).toBe(new Date('2026-03-31T23:59:59.999').toISOString())
  })

  it('drops filters on columns it does not offer (a stale query string)', () => {
    expect(buildListFilter({ columns, filters: { password: 'x' } })).toBeUndefined()
  })

  it('searches every text column with an $or, ANDed with the filters', () => {
    expect(buildListFilter({ columns, filters: { role: 'user' }, search: ' hello ', searchFields: ['title', 'body'] })).toEqual({
      role: { $eq: 'user' },
      $or: [{ title: { $like: 'hello' } }, { body: { $like: 'hello' } }],
    })
    // the same column searched and filtered: both conditions hold
    expect(buildListFilter({ columns, filters: { title: 'a' }, search: 'b', searchFields: ['title'] })).toEqual({
      title: { $like: 'a' },
      $or: [{ title: { $like: 'b' } }],
    })
  })

  it('searchFieldsOf: the text columns, at most the 20 an $or accepts', () => {
    expect(searchFieldsOf(columns)).toEqual(['title', 'body'])
    const many = Array.from({ length: 25 }, (_, i) => ({ name: `c${i}`, kind: 'text' as const }))
    expect(searchFieldsOf(many)).toHaveLength(20)
  })
})

describe('filter state in the query string', () => {
  it('round-trips and drops empty entries', () => {
    const state = { title: 'x', role: '', views: { min: '1', max: '' }, createdAt: { min: '', max: '' } }
    const raw = serializeFilterState(state)
    expect(raw).toBe('{"title":"x","views":{"min":"1"}}')
    expect(parseFilterState(raw)).toEqual({ title: 'x', views: { min: '1' } })
    expect(serializeFilterState({ title: '' })).toBeUndefined()
  })

  it('ignores malformed input', () => {
    expect(parseFilterState(undefined)).toEqual({})
    expect(parseFilterState('{nope')).toEqual({})
    expect(parseFilterState('[1]')).toEqual({})
    expect(parseFilterState(['a'])).toEqual({})
    expect(parseFilterState('{"a":1,"b":{"min":2,"max":"3"},"c":"ok"}')).toEqual({ b: { max: '3' }, c: 'ok' })
  })

  it('counts the filters that are set', () => {
    expect(activeFilterCount({ a: 'x', b: '', c: { min: '1' }, d: { min: '', max: '' } })).toBe(2)
  })
})
