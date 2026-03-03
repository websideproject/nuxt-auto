import type { ColumnMetadata, WidgetType } from '../types'

/**
 * Map Drizzle column type to widget component
 */
export function mapColumnTypeToWidget(column: ColumnMetadata): WidgetType {
  const { name, type, dataType, enumValues, foreignKey } = column

  // Check for foreign keys first
  if (foreignKey) {
    return 'RelationSelect'
  }

  // Check for enum values
  if (enumValues && enumValues.length > 0) {
    return 'SelectInput'
  }

  // Check for password fields
  if (name.toLowerCase().includes('password')) {
    return 'PasswordInput'
  }

  // Map based on column type
  const lowerType = (type || dataType || '').toLowerCase()

  // Date/time by naming convention — checked before numeric type so that *At integer
  // columns (Drizzle timestamp stored as integer) resolve to DateTimePicker, not NumberInput
  const lowerName = name.toLowerCase()
  if (lowerName.endsWith('at') || lowerName.endsWith('date')) {
    return 'DateTimePicker'
  }

  // Boolean fields
  if (lowerType.includes('boolean') || (lowerType.includes('integer') && name.startsWith('is'))) {
    return 'CheckboxInput'
  }

  // Numeric fields
  if (
    lowerType.includes('integer') ||
    lowerType.includes('number') ||
    lowerType.includes('decimal') ||
    lowerType.includes('float') ||
    lowerType.includes('real') ||
    lowerType.includes('numeric')
  ) {
    return 'NumberInput'
  }

  // Date/time fields by type
  if (
    lowerType.includes('timestamp') ||
    lowerType.includes('datetime') ||
    lowerType.includes('date')
  ) {
    return 'DateTimePicker'
  }

  // Text area for longer text fields
  if (
    lowerType === 'text' ||
    name.toLowerCase().includes('description') ||
    name.toLowerCase().includes('content') ||
    name.toLowerCase().includes('body') ||
    name.toLowerCase().includes('bio') ||
    name.toLowerCase().includes('notes')
  ) {
    return 'TextareaInput'
  }

  // JSON fields
  if (lowerType.includes('json')) {
    return 'JsonEditor'
  }

  // Default to text input
  return 'TextInput'
}

/**
 * Format field label from column name
 * Converts camelCase/snake_case to readable title
 */
export function formatFieldLabel(fieldName: string): string {
  return (
    fieldName
      // Handle snake_case
      .replace(/_/g, ' ')
      // Handle camelCase
      .replace(/([A-Z])/g, ' $1')
      // Capitalize first letter of each word
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim()
  )
}

/**
 * Format value for display in table or detail view
 */
export function formatDisplayValue(value: any, column: ColumnMetadata): string {
  if (value === null || value === undefined) {
    return '-'
  }

  // Boolean values
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  // Date/time values
  if (
    column.type?.includes('timestamp') ||
    column.type?.includes('date') ||
    column.name.toLowerCase().endsWith('at')
  ) {
    try {
      const date = new Date(value)
      return date.toLocaleString()
    } catch {
      return String(value)
    }
  }

  // JSON values
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }

  // Truncate long text
  const strValue = String(value)
  if (strValue.length > 100) {
    return strValue.substring(0, 100) + '...'
  }

  return strValue
}

/**
 * Check if field should be excluded from list view
 */
export function shouldExcludeFromList(column: ColumnMetadata): boolean {
  const excludeNames = [
    'password',
    'token',
    'secret',
    'apiKey',
    'refreshToken',
    'accessToken',
    'deletedAt',
  ]

  // Exclude by name (case-insensitive comparison)
  if (excludeNames.some((name) => column.name.toLowerCase().includes(name.toLowerCase()))) {
    return true
  }

  // Exclude large text fields
  if (
    column.type === 'text' &&
    (column.name.toLowerCase().includes('content') ||
      column.name.toLowerCase().includes('body') ||
      column.name.toLowerCase().includes('description'))
  ) {
    return true
  }

  // Exclude JSON fields
  if (column.type?.includes('json')) {
    return true
  }

  return false
}

/**
 * Check if field is sensitive and should be hidden
 */
export function isSensitiveField(fieldName: string): boolean {
  const sensitivePatterns = ['password', 'token', 'secret', 'apikey', 'key', 'salt', 'hash']

  return sensitivePatterns.some((pattern) => fieldName.toLowerCase().includes(pattern))
}

/**
 * Get validation rules based on column metadata
 */
export function getValidationRules(column: ColumnMetadata): any {
  const rules: any = {}

  if (!column.isNullable && !column.defaultValue) {
    rules.required = true
  }

  if (column.type?.includes('email')) {
    rules.email = true
  }

  if (column.type?.includes('url')) {
    rules.url = true
  }

  // Add min/max for numeric fields
  if (
    column.type?.includes('integer') ||
    column.type?.includes('number') ||
    column.type?.includes('decimal')
  ) {
    // These would come from column constraints if available
    if (column.constraints) {
      // Parse constraints for min/max
    }
  }

  return Object.keys(rules).length > 0 ? rules : undefined
}
