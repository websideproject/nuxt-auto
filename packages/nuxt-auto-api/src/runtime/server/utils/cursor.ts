import { createError } from 'h3'
import { gt, lt, and } from 'drizzle-orm'

/**
 * Encode cursor from record data
 * Format: base64url({ id, createdAt, ... })
 */
export function encodeCursor(record: any, cursorFields: string[] = ['id']): string {
  const cursorData: Record<string, any> = {}
  for (const field of cursorFields) {
    cursorData[field] = record[field]
  }
  return Buffer.from(JSON.stringify(cursorData)).toString('base64url')
}

/**
 * Decode cursor to record data
 */
export function decodeCursor(cursor: string): Record<string, any> {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    return JSON.parse(decoded)
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid cursor' })
  }
}

/**
 * Build where clause for cursor pagination
 * Supports composite cursors (multiple fields)
 */
export function buildCursorWhere(
  table: any,
  cursor: string,
  cursorFields: string[],
  direction: 'asc' | 'desc' = 'asc'
) {
  const cursorData = decodeCursor(cursor)

  // For single field cursor (simple case)
  if (cursorFields.length === 1) {
    const field = cursorFields[0]
    const value = cursorData[field]

    if (direction === 'asc') {
      return gt(table[field], value)
    } else {
      return lt(table[field], value)
    }
  }

  // For composite cursors, we need to handle it differently
  // For now, use the first field as the primary cursor
  // TODO: Implement proper composite cursor support
  const field = cursorFields[0]
  const value = cursorData[field]

  if (direction === 'asc') {
    return gt(table[field], value)
  } else {
    return lt(table[field], value)
  }
}
