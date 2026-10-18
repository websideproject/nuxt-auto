import type { FieldConfig } from '../types'

/**
 * The form's own check of one field before submit: `required`, and the `minLength` / `maxLength` options of text
 * widgets. Every other rule is the API's (its errors are mapped onto the fields after a refused save).
 */
export function clientFieldError(field: FieldConfig, value: unknown): string | undefined {
  const empty = value === undefined || value === null || value === ''
  if (field.required && (empty || value === false)) return 'This field is required'
  if (empty || typeof value !== 'string') return undefined
  const { minLength, maxLength } = field.options ?? {}
  if (typeof minLength === 'number' && value.length < minLength) return `At least ${minLength} characters`
  if (typeof maxLength === 'number' && value.length > maxLength) return `At most ${maxLength} characters`
  return undefined
}
