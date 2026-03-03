import { describe, it, expect } from 'vitest'
import { buildRelations } from '../../../src/runtime/server/utils/buildRelations'

describe('buildRelations', () => {
  it('should build relations object from string', () => {
    const result = buildRelations('author,comments', {})

    expect(result).toEqual({
      author: true,
      comments: true
    })
  })

  it('should build relations object from array', () => {
    const result = buildRelations(['author', 'comments'], {})

    expect(result).toEqual({
      author: true,
      comments: true
    })
  })

  it('should handle single relation', () => {
    const result = buildRelations('author', {})

    expect(result).toEqual({ author: true })
  })

  it('should return undefined for empty string', () => {
    const result = buildRelations('', {})

    expect(result).toBeUndefined()
  })

  it('should return undefined for undefined input', () => {
    const result = buildRelations(undefined, {})

    expect(result).toBeUndefined()
  })

  it('should return undefined for null input', () => {
    const result = buildRelations(null as any, {})

    expect(result).toBeUndefined()
  })

  it('should trim whitespace', () => {
    const result = buildRelations(' author , comments ', {})

    expect(result).toEqual({
      author: true,
      comments: true
    })
  })

  it('should handle empty array', () => {
    const result = buildRelations([], {})

    expect(result).toBeUndefined()
  })

  it('should handle array with empty strings', () => {
    const result = buildRelations(['', '  '], {})

    // Empty strings will still create entries, but they'll be filtered
    expect(result).toBeDefined()
  })

  it('should handle relations with numbers', () => {
    const result = buildRelations(['author', 'comments2', 'tags3'], {})

    expect(result).toEqual({
      author: true,
      comments2: true,
      tags3: true
    })
  })
})
