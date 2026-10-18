import { describe, it, expect } from 'vitest'
import { clientFieldError } from '../../../src/runtime/utils/fieldValidation'
import { apiFieldErrors } from '../../../src/runtime/utils/apiErrors'

describe('clientFieldError', () => {
  it('requires a value, and a checked checkbox', () => {
    expect(clientFieldError({ name: 'title', required: true }, '')).toBe('This field is required')
    expect(clientFieldError({ name: 'agree', required: true, widget: 'CheckboxInput' }, false)).toBe('This field is required')
    expect(clientFieldError({ name: 'count', required: true }, 0)).toBeUndefined()
  })

  it('applies minLength and maxLength to text', () => {
    const field = { name: 'slug', options: { minLength: 3, maxLength: 5 } }
    expect(clientFieldError(field, 'ab')).toBe('At least 3 characters')
    expect(clientFieldError(field, 'abcdef')).toBe('At most 5 characters')
    expect(clientFieldError(field, 'abcd')).toBeUndefined()
    // An empty optional field is not too short
    expect(clientFieldError(field, '')).toBeUndefined()
  })
})

describe('apiFieldErrors', () => {
  const refused = {
    statusCode: 400,
    data: { message: 'Validation error', data: { errors: [
      { path: ['title'], message: 'Too short' },
      { path: ['title'], message: 'Second issue' },
      { path: ['meta', 'seo'], message: 'Invalid' },
      { path: [], message: 'Body is wrong' },
    ] } },
  }

  it('puts the first issue of each shown field under it, and the rest aside', () => {
    expect(apiFieldErrors(refused, ['title', 'content'])).toEqual({
      fields: { title: 'Too short' },
      other: ['meta.seo: Invalid', 'Body is wrong'],
    })
  })

  it('has nothing for an error without issues', () => {
    expect(apiFieldErrors({ statusCode: 403, data: { message: 'Forbidden' } }, ['title'])).toEqual({ fields: {}, other: [] })
  })
})
