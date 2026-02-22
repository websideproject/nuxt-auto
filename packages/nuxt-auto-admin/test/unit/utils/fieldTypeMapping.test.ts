import { describe, it, expect } from 'vitest'
import {
  mapColumnTypeToWidget,
  formatFieldLabel,
  formatDisplayValue,
  shouldExcludeFromList,
  isSensitiveField,
  getValidationRules,
} from '../../../src/runtime/utils/fieldTypeMapping'
import type { ColumnMetadata } from '../../../src/runtime/types'

function col(overrides: Partial<ColumnMetadata>): ColumnMetadata {
  return {
    name: 'field',
    type: 'text',
    dataType: 'string',
    isNullable: true,
    isPrimaryKey: false,
    isAutoIncrement: false,
    isUnique: false,
    ...overrides,
  }
}

// ─── mapColumnTypeToWidget ────────────────────────────────────────────────────

describe('mapColumnTypeToWidget', () => {
  it('returns RelationSelect for foreign key columns', () => {
    expect(mapColumnTypeToWidget(col({ foreignKey: { table: 'users', column: 'id' } as any }))).toBe('RelationSelect')
  })

  it('returns SelectInput for enum columns', () => {
    expect(mapColumnTypeToWidget(col({ enumValues: ['a', 'b'] }))).toBe('SelectInput')
  })

  it('returns PasswordInput for password-named columns', () => {
    expect(mapColumnTypeToWidget(col({ name: 'password' }))).toBe('PasswordInput')
    expect(mapColumnTypeToWidget(col({ name: 'userPassword' }))).toBe('PasswordInput')
  })

  it('returns CheckboxInput for boolean type', () => {
    expect(mapColumnTypeToWidget(col({ name: 'active', type: 'boolean' }))).toBe('CheckboxInput')
  })

  it('returns CheckboxInput for integer columns named is*', () => {
    expect(mapColumnTypeToWidget(col({ name: 'isActive', type: 'integer' }))).toBe('CheckboxInput')
  })

  it('returns NumberInput for integer columns', () => {
    expect(mapColumnTypeToWidget(col({ name: 'count', type: 'integer' }))).toBe('NumberInput')
  })

  it('returns NumberInput for decimal/float/real/numeric types', () => {
    for (const type of ['decimal', 'float', 'real', 'numeric']) {
      expect(mapColumnTypeToWidget(col({ name: 'price', type }))).toBe('NumberInput')
    }
  })

  it('returns DateTimePicker for timestamp type', () => {
    expect(mapColumnTypeToWidget(col({ name: 'ts', type: 'timestamp' }))).toBe('DateTimePicker')
  })

  it('returns DateTimePicker for columns ending in At', () => {
    expect(mapColumnTypeToWidget(col({ name: 'createdAt', type: 'integer' }))).toBe('DateTimePicker')
    expect(mapColumnTypeToWidget(col({ name: 'deletedAt', type: 'integer' }))).toBe('DateTimePicker')
  })

  it('returns DateTimePicker for columns ending in Date', () => {
    expect(mapColumnTypeToWidget(col({ name: 'birthDate', type: 'text' }))).toBe('DateTimePicker')
  })

  it('returns TextareaInput for text type', () => {
    expect(mapColumnTypeToWidget(col({ name: 'field', type: 'text' }))).toBe('TextareaInput')
  })

  it('returns TextareaInput for content/description/body/bio/notes named columns', () => {
    for (const name of ['content', 'description', 'body', 'bio', 'notes', 'shortDescription']) {
      expect(mapColumnTypeToWidget(col({ name, type: 'varchar' }))).toBe('TextareaInput')
    }
  })

  it('returns JsonEditor for json type', () => {
    expect(mapColumnTypeToWidget(col({ name: 'meta', type: 'json' }))).toBe('JsonEditor')
  })

  it('defaults to TextInput for unknown types', () => {
    expect(mapColumnTypeToWidget(col({ name: 'title', type: 'varchar' }))).toBe('TextInput')
  })

  it('foreign key check takes precedence over enum', () => {
    expect(
      mapColumnTypeToWidget(col({ foreignKey: { table: 'roles', column: 'id' } as any, enumValues: ['a'] }))
    ).toBe('RelationSelect')
  })
})

// ─── formatFieldLabel ─────────────────────────────────────────────────────────

describe('formatFieldLabel', () => {
  it('converts camelCase to Title Case', () => {
    expect(formatFieldLabel('firstName')).toBe('First Name')
    expect(formatFieldLabel('createdAt')).toBe('Created At')
  })

  it('converts snake_case to Title Case', () => {
    expect(formatFieldLabel('first_name')).toBe('First Name')
    expect(formatFieldLabel('user_id')).toBe('User Id')
  })

  it('handles single word', () => {
    expect(formatFieldLabel('email')).toBe('Email')
    expect(formatFieldLabel('id')).toBe('Id')
  })

  it('handles already-capitalized words', () => {
    expect(formatFieldLabel('APIKey')).toBe('A P I Key')
  })
})

// ─── formatDisplayValue ───────────────────────────────────────────────────────

describe('formatDisplayValue', () => {
  it('returns dash for null', () => {
    expect(formatDisplayValue(null, col({}))).toBe('-')
    expect(formatDisplayValue(undefined, col({}))).toBe('-')
  })

  it('formats booleans as Yes/No', () => {
    expect(formatDisplayValue(true, col({}))).toBe('Yes')
    expect(formatDisplayValue(false, col({}))).toBe('No')
  })

  it('formats JSON objects as pretty string', () => {
    const result = formatDisplayValue({ a: 1 }, col({ name: 'meta', type: 'json' }))
    expect(result).toContain('"a": 1')
  })

  it('truncates long strings at 100 characters', () => {
    const long = 'a'.repeat(150)
    const result = formatDisplayValue(long, col({}))
    expect(result).toHaveLength(103) // 100 + '...'
    expect(result.endsWith('...')).toBe(true)
  })

  it('returns value as string for normal values', () => {
    expect(formatDisplayValue('hello', col({}))).toBe('hello')
    expect(formatDisplayValue(42, col({}))).toBe('42')
  })
})

// ─── shouldExcludeFromList ────────────────────────────────────────────────────

describe('shouldExcludeFromList', () => {
  it('excludes password-related fields', () => {
    expect(shouldExcludeFromList(col({ name: 'password' }))).toBe(true)
    expect(shouldExcludeFromList(col({ name: 'hashedPassword' }))).toBe(true)
  })

  it('excludes token/secret/key fields', () => {
    expect(shouldExcludeFromList(col({ name: 'token' }))).toBe(true)
    expect(shouldExcludeFromList(col({ name: 'secret' }))).toBe(true)
    expect(shouldExcludeFromList(col({ name: 'apiKey' }))).toBe(true)
    expect(shouldExcludeFromList(col({ name: 'refreshToken' }))).toBe(true)
    expect(shouldExcludeFromList(col({ name: 'accessToken' }))).toBe(true)
  })

  it('excludes deletedAt field', () => {
    expect(shouldExcludeFromList(col({ name: 'deletedAt' }))).toBe(true)
  })

  it('excludes text columns named content/body/description', () => {
    expect(shouldExcludeFromList(col({ name: 'content', type: 'text' }))).toBe(true)
    expect(shouldExcludeFromList(col({ name: 'body', type: 'text' }))).toBe(true)
    expect(shouldExcludeFromList(col({ name: 'description', type: 'text' }))).toBe(true)
  })

  it('excludes json fields', () => {
    expect(shouldExcludeFromList(col({ name: 'meta', type: 'json' }))).toBe(true)
  })

  it('does not exclude normal fields', () => {
    expect(shouldExcludeFromList(col({ name: 'name', type: 'text' }))).toBe(false)
    expect(shouldExcludeFromList(col({ name: 'email', type: 'varchar' }))).toBe(false)
    expect(shouldExcludeFromList(col({ name: 'title', type: 'varchar' }))).toBe(false)
  })
})

// ─── isSensitiveField ─────────────────────────────────────────────────────────

describe('isSensitiveField', () => {
  it('flags password fields', () => {
    expect(isSensitiveField('password')).toBe(true)
    expect(isSensitiveField('userPassword')).toBe(true)
  })

  it('flags token/secret/key/salt/hash fields', () => {
    expect(isSensitiveField('token')).toBe(true)
    expect(isSensitiveField('secret')).toBe(true)
    expect(isSensitiveField('apikey')).toBe(true)
    expect(isSensitiveField('salt')).toBe(true)
    expect(isSensitiveField('hash')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isSensitiveField('APIKey')).toBe(true)
    expect(isSensitiveField('PASSWORD')).toBe(true)
  })

  it('does not flag normal fields', () => {
    expect(isSensitiveField('email')).toBe(false)
    expect(isSensitiveField('name')).toBe(false)
    expect(isSensitiveField('createdAt')).toBe(false)
  })
})

// ─── getValidationRules ───────────────────────────────────────────────────────

describe('getValidationRules', () => {
  it('returns required: true for non-nullable columns without default', () => {
    const rules = getValidationRules(col({ isNullable: false, defaultValue: undefined }))
    expect(rules?.required).toBe(true)
  })

  it('returns undefined for nullable columns', () => {
    const rules = getValidationRules(col({ isNullable: true }))
    expect(rules).toBeUndefined()
  })

  it('returns undefined for non-nullable columns with a default value', () => {
    const rules = getValidationRules(col({ isNullable: false, defaultValue: 'default' }))
    expect(rules).toBeUndefined()
  })
})
