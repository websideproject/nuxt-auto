/**
 * Runtime utility functions for the generated registry
 * These functions will be included in the virtual module
 */

/**
 * Format field label from column name
 */
export function formatFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

/**
 * Map column type to widget component name
 */
export function mapColumnTypeToWidget(column: any): string {
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

  // Date/time fields
  if (
    lowerType.includes('timestamp') ||
    lowerType.includes('datetime') ||
    lowerType.includes('date') ||
    name.toLowerCase().endsWith('at') ||
    name.toLowerCase().endsWith('date')
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
