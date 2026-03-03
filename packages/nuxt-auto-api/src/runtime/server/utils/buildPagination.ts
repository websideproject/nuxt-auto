import type { ListQuery, AutoApiOptions } from '../../types'

/**
 * Build pagination configuration from query parameters
 */
export function buildPagination(
  query: ListQuery,
  options?: AutoApiOptions['pagination']
) {
  const defaultLimit = options?.defaultLimit || 20
  const maxLimit = options?.maxLimit || 100

  let limit = query.limit ? parseInt(String(query.limit), 10) : defaultLimit

  // Enforce max limit
  if (limit > maxLimit) {
    limit = maxLimit
  }

  // Ensure positive limit
  if (limit < 1) {
    limit = defaultLimit
  }

  const result: {
    limit: number
    offset?: number
    cursor?: string
  } = { limit }

  // Handle offset pagination
  if (query.page !== undefined) {
    const page = Math.max(1, parseInt(String(query.page), 10))
    result.offset = (page - 1) * limit
  }

  // Handle cursor pagination (future enhancement)
  if (query.cursor) {
    result.cursor = query.cursor
  }

  return result
}
