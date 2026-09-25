import { describe, it, expect } from 'vitest'
import { parseIncludeParam } from '../../../src/runtime/server/utils/includes'

describe('parseIncludeParam', () => {
  it('returns [] for nothing', () => {
    expect(parseIncludeParam(undefined)).toEqual([])
    expect(parseIncludeParam('')).toEqual([])
    expect(parseIncludeParam([])).toEqual([])
    expect(parseIncludeParam(['', ' '])).toEqual([])
  })

  it('parses a comma list and arrays, trimming whitespace', () => {
    expect(parseIncludeParam(' author , comments ').map(s => s.relation)).toEqual(['author', 'comments'])
    expect(parseIncludeParam(['author', 'comments,tags']).map(s => s.relation)).toEqual(['author', 'comments', 'tags'])
  })

  it('nests dotted paths and merges shared prefixes', () => {
    const [comments] = parseIncludeParam('comments.author,comments.post')
    expect(comments!.relation).toBe('comments')
    expect(comments!.children.map(c => c.relation)).toEqual(['author', 'post'])
  })

  it('parses field selection (commas inside brackets do not split)', () => {
    const specs = parseIncludeParam('author[id,name],comments')
    expect(specs[0]).toMatchObject({ relation: 'author', fields: ['id', 'name'] })
    expect(specs[1]!.relation).toBe('comments')
  })

  it('parses limit / offset / filter (JSON and unquoted-key shorthand)', () => {
    expect(parseIncludeParam('comments{limit:5,offset:10}')[0]).toMatchObject({ limit: 5, offset: 10 })
    expect(parseIncludeParam('comments{filter:{approved:true}}')[0]!.filter).toEqual({ approved: true })
    expect(parseIncludeParam('comments{filter:{"n":{"$gt":1}}}')[0]!.filter).toEqual({ n: { $gt: 1 } })
  })

  it('parses combined options at several levels', () => {
    const [comments] = parseIncludeParam('comments[id,content]{limit:2}.author[id]')
    expect(comments).toMatchObject({ relation: 'comments', fields: ['id', 'content'], limit: 2 })
    expect(comments!.children[0]).toMatchObject({ relation: 'author', fields: ['id'] })
  })

  it.each([
    ['1bad'],
    ['author[]'],
    ['comments{limit:-1}'],
    ['comments{limit:abc}'],
    ['comments{nope:1}'],
    ['comments{filter:{bad json}}'],
    ['comments{limit}'],
  ])('rejects %s with a 400', (include) => {
    expect(() => parseIncludeParam(include)).toThrow(expect.objectContaining({ statusCode: 400 }))
  })
})
