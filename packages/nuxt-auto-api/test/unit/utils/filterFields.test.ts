import { describe, it, expect } from 'vitest'
import { filterFields } from '../../../src/runtime/server/utils/filterFields'

describe('filterFields', () => {
  it('should filter single object', () => {
    const data = { id: 1, name: 'John', email: 'john@test.com', password: 'secret' }
    const result = filterFields(data, ['id', 'name'])

    expect(result).toEqual({ id: 1, name: 'John' })
  })

  it('should filter array of objects', () => {
    const data = [
      { id: 1, name: 'John', email: 'john@test.com' },
      { id: 2, name: 'Jane', email: 'jane@test.com' }
    ]
    const result = filterFields(data, ['id', 'name'])

    expect(result).toEqual([
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' }
    ])
  })

  it('should handle comma-separated string', () => {
    const data = { id: 1, name: 'John', email: 'john@test.com' }
    const result = filterFields(data, 'id,name')

    expect(result).toEqual({ id: 1, name: 'John' })
  })

  it('should return all fields if no filter', () => {
    const data = { id: 1, name: 'John' }
    const result = filterFields(data, undefined)

    expect(result).toEqual(data)
  })

  it('should handle empty fields array', () => {
    const data = { id: 1, name: 'John', email: 'john@test.com' }
    const result = filterFields(data, [])

    expect(result).toEqual({})
  })

  it('should handle non-existent fields', () => {
    const data = { id: 1, name: 'John' }
    const result = filterFields(data, ['id', 'nonexistent'])

    expect(result).toEqual({ id: 1 })
  })

  it('should trim whitespace in comma-separated string', () => {
    const data = { id: 1, name: 'John', email: 'john@test.com' }
    const result = filterFields(data, ' id , name ')

    expect(result).toEqual({ id: 1, name: 'John' })
  })

  it('should handle empty array of data', () => {
    const data: any[] = []
    const result = filterFields(data, ['id', 'name'])

    expect(result).toEqual([])
  })

  it('should handle array with one item', () => {
    const data = [{ id: 1, name: 'John', email: 'john@test.com' }]
    const result = filterFields(data, ['id'])

    expect(result).toEqual([{ id: 1 }])
  })

  it('should preserve order of fields in result', () => {
    const data = { id: 1, name: 'John', email: 'john@test.com', age: 30 }
    const result = filterFields(data, ['email', 'id'])

    const keys = Object.keys(result)
    expect(keys).toEqual(['email', 'id'])
  })

  it('should handle nested objects by keeping only top-level fields', () => {
    const data = {
      id: 1,
      name: 'John',
      profile: { age: 30, city: 'NYC' }
    }
    const result = filterFields(data, ['id', 'profile'])

    expect(result).toEqual({
      id: 1,
      profile: { age: 30, city: 'NYC' }
    })
  })
})
