import { describe, it, expect } from 'vitest'
import { formatDate, formatHasTime, parseDate } from '../../../src/runtime/utils/dateFormat'

const d = new Date(2026, 9, 18, 7, 5, 9)

describe('DateTimePicker format', () => {
  it('writes a date in the pattern', () => {
    expect(formatDate(d, 'YYYY-MM-DD HH:mm')).toBe('2026-10-18 07:05')
    expect(formatDate(d, 'DD/MM/YYYY')).toBe('18/10/2026')
    expect(formatDate(d, 'HH:mm:ss')).toBe('07:05:09')
  })

  it('reads it back', () => {
    expect(parseDate('2026-10-18 07:05', 'YYYY-MM-DD HH:mm')).toEqual(new Date(2026, 9, 18, 7, 5))
    expect(parseDate('18/10/2026', 'DD/MM/YYYY')).toEqual(new Date(2026, 9, 18))
    expect(parseDate(' 8/3/2026 ', 'DD/MM/YYYY')).toEqual(new Date(2026, 2, 8))
  })

  it('refuses text that does not match or is not a real date', () => {
    expect(parseDate('2026-10-18', 'DD/MM/YYYY')).toBeNull()
    expect(parseDate('31/02/2026', 'DD/MM/YYYY')).toBeNull()
    expect(parseDate('18/10/2026 25:00', 'DD/MM/YYYY HH:mm')).toBeNull()
  })

  it('treats pattern punctuation literally', () => {
    expect(parseDate('18.10.2026', 'DD.MM.YYYY')).toEqual(new Date(2026, 9, 18))
    expect(parseDate('18x10x2026', 'DD.MM.YYYY')).toBeNull()
  })

  it('knows whether the pattern has a time', () => {
    expect(formatHasTime('YYYY-MM-DD HH:mm')).toBe(true)
    expect(formatHasTime('DD/MM/YYYY')).toBe(false)
  })
})
