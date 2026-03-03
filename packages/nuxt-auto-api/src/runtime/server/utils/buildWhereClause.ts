import { SQL, and, or, eq, ne, gt, gte, lt, lte, like, inArray, isNull, isNotNull } from 'drizzle-orm'

/**
 * Build a WHERE clause from a filter object
 *
 * Supports:
 * - filter[field]=value (equals)
 * - filter[field][$eq]=value (equals)
 * - filter[field][$ne]=value (not equals)
 * - filter[field][$gt]=value (greater than)
 * - filter[field][$gte]=value (greater than or equal)
 * - filter[field][$lt]=value (less than)
 * - filter[field][$lte]=value (less than or equal)
 * - filter[field][$like]=value (like/contains)
 * - filter[field][$in]=value1,value2 (in array)
 * - filter[field][$null]=true/false (is null/not null)
 */
export function buildWhereClause(filter: Record<string, any>, table: any): SQL | undefined {
  if (!filter || typeof filter !== 'object') {
    return undefined
  }

  const conditions: SQL[] = []

  for (const [field, value] of Object.entries(filter)) {
    // Skip if field doesn't exist in table
    if (!(field in table)) {
      continue
    }

    const column = table[field]

    // Handle operators
    if (value && typeof value === 'object') {
      for (const [operator, operatorValue] of Object.entries(value)) {
        switch (operator) {
          case '$eq':
            conditions.push(eq(column, operatorValue))
            break
          case '$ne':
            conditions.push(ne(column, operatorValue))
            break
          case '$gt':
            conditions.push(gt(column, operatorValue))
            break
          case '$gte':
            conditions.push(gte(column, operatorValue))
            break
          case '$lt':
            conditions.push(lt(column, operatorValue))
            break
          case '$lte':
            conditions.push(lte(column, operatorValue))
            break
          case '$like':
            conditions.push(like(column, `%${operatorValue}%`))
            break
          case '$in':
            const values = Array.isArray(operatorValue)
              ? operatorValue
              : String(operatorValue).split(',')
            conditions.push(inArray(column, values))
            break
          case '$null':
            if (operatorValue === true || operatorValue === 'true') {
              conditions.push(isNull(column))
            } else {
              conditions.push(isNotNull(column))
            }
            break
        }
      }
    } else {
      // Simple equality
      conditions.push(eq(column, value))
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}
