import { describe, it, expect } from 'vitest'
import { singularize } from '../../src/module'

describe('singularize (one record of a resource, from its display name)', () => {
  it.each([
    ['Articles', 'Article'],
    ['Categories', 'Category'],
    ['API Keys', 'API Key'],
    ['Addresses', 'Address'],
    ['Boxes', 'Box'],
    ['Branches', 'Branch'],
    ['Status', 'Status'],
    ['Analysis', 'Analysis'],
    ['Settings', 'Setting'],
    ['Data', 'Data'],
  ])('%s → %s', (plural, one) => {
    expect(singularize(plural)).toBe(one)
  })
})
