import { describe, it, expect } from 'vitest'
import { jsonText, parseByteSize, parseJsonText, slugify, toTags, toolbarItems } from '../../../src/runtime/utils/widgetValues'

describe('widget values', () => {
  it('slugify', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
    expect(slugify('  Crème brûlée — 2026 ')).toBe('creme-brulee-2026')
    expect(slugify('---')).toBe('')
  })

  it('toTags reads arrays, JSON arrays and comma lists', () => {
    expect(toTags(['a', 1])).toEqual(['a', '1'])
    expect(toTags('["vue","nuxt"]')).toEqual(['vue', 'nuxt'])
    expect(toTags('vue, nuxt ,, drizzle')).toEqual(['vue', 'nuxt', 'drizzle'])
    expect(toTags(null)).toEqual([])
  })

  it('jsonText / parseJsonText round-trip', () => {
    expect(jsonText({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}')
    expect(jsonText(null)).toBe('')
    expect(parseJsonText(jsonText({ a: [1] }))).toEqual({ value: { a: [1] } })
    expect(parseJsonText('')).toEqual({ value: null })
    expect(parseJsonText('{ a: 1 }')).toHaveProperty('error')
  })

  it('parseByteSize', () => {
    expect(parseByteSize('2mb')).toBe(2 * 1024 ** 2)
    expect(parseByteSize('500 KB')).toBe(500 * 1024)
    expect(parseByteSize(1000)).toBe(1000)
    expect(parseByteSize('big')).toBeUndefined()
  })

  it('toolbarItems groups names and skips unknown ones', () => {
    expect(toolbarItems(['bold', 'nope', '|', 'heading2', '|'])).toEqual([
      [expect.objectContaining({ kind: 'mark', mark: 'bold' })],
      [expect.objectContaining({ kind: 'heading', level: 2 })],
    ])
    expect(toolbarItems().length).toBeGreaterThan(3)
  })
})
