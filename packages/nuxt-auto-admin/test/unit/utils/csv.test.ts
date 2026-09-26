import { describe, it, expect } from 'vitest'
import { parseCsv, toCsv } from '../../../src/runtime/utils/csv'

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks (RFC 4180)', () => {
    const csv = toCsv([{ a: 'plain', b: 'x,y', c: 'say "hi"', d: 'two\nlines' }])
    expect(csv).toBe('a,b,c,d\r\nplain,"x,y","say ""hi""","two\nlines"')
  })

  it('neutralises cells a spreadsheet would run as a formula', () => {
    const csv = toCsv([{ v: '=SUM(A1)' }, { v: '+1' }, { v: '-2' }, { v: '@cmd' }, { v: '\tx' }, { v: '\rx' }, { v: 'safe=1' }])
    expect(csv.split('\r\n').slice(1, 5)).toEqual(['\'=SUM(A1)', '\'+1', '\'-2', '\'@cmd'])
    expect(csv).toContain('\'\tx')
    expect(csv).toContain('"\'\rx"')
    expect(csv.endsWith('safe=1')).toBe(true)
  })

  it('writes null as empty, objects as JSON, and follows `fields`', () => {
    expect(toCsv([{ a: null, b: { k: 1 }, c: 3 }], ['c', 'b', 'a'])).toBe('c,b,a\r\n3,"{""k"":1}",')
    expect(toCsv([])).toBe('')
  })
})

describe('parseCsv', () => {
  it('reads quoted cells with commas, escaped quotes and line breaks', () => {
    expect(parseCsv('a,b,c\r\n"x,y","say ""hi""","two\nlines"\r\n')).toEqual([
      ['a', 'b', 'c'],
      ['x,y', 'say "hi"', 'two\nlines'],
    ])
  })

  it('accepts LF rows, a byte-order mark, empty cells and a missing final newline; skips blank lines', () => {
    expect(parseCsv('﻿a,b\n1,\n\n,2')).toEqual([['a', 'b'], ['1', ''], ['', '2']])
  })

  it('round-trips what toCsv writes (apart from the formula guard)', () => {
    const rows = [{ title: 'Hello, "world"', body: 'line1\r\nline2', n: 3 }]
    const [header, ...data] = parseCsv(toCsv(rows))
    expect(header).toEqual(['title', 'body', 'n'])
    expect(data).toEqual([['Hello, "world"', 'line1\r\nline2', '3']])
  })
})
