import { describe, it, expect } from 'vitest'
import { listRelations, relationCellText } from '../../../src/runtime/utils/listQuery'

const columns = [{ name: 'id' }, { name: 'title' }, { name: 'authorId' }] as any

describe('relations in listFields', () => {
  it('includes the relations named by non-column fields', () => {
    expect(listRelations({ columns, listFields: ['id', 'title', 'author.name', 'author.email', 'tags'] })).toEqual(['author', 'tags'])
    expect(listRelations({ columns, listFields: ['id', 'title'] })).toEqual([])
  })

  it('shows one field, a label field, or a joined to-many relation', () => {
    const row = { author: { id: 1, name: 'Ada', email: 'ada@x.io' }, tags: [{ name: 'vue' }, { name: 'nuxt' }, { name: 'ts' }, { name: 'sql' }], editor: null }
    expect(relationCellText(row, 'author.email')).toBe('ada@x.io')
    expect(relationCellText(row, 'author')).toBe('Ada')
    expect(relationCellText(row, 'tags')).toBe('vue, nuxt, ts +1')
    expect(relationCellText(row, 'editor')).toBe('')
  })
})
