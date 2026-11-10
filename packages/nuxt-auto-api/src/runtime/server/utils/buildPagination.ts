import type { ListQuery, AutoApiOptions } from '../../types'

/**
 * Build pagination configuration from query parameters
 */
export function buildPagination(
  query: ListQuery,
  options?: AutoApiOptions['pagination'],
) {
  const defaultLimit = options?.defaultLimit || 20
  const maxLimit = options?.maxLimit || 100

  let limit = query.limit ? Number.parseInt(String(query.limit), 10) : defaultLimit

  // Enforce max limit. The caller is told (`meta.clamped`): a list cut short without a sign reads as "that's all".
  const clamped = limit > maxLimit
  if (clamped) {
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
    clamped?: boolean
  } = { limit }
  if (clamped) result.clamped = true

  // Handle offset pagination
  if (query.page !== undefined) {
    const page = Math.max(1, Number.parseInt(String(query.page), 10))
    result.offset = (page - 1) * limit
  }

  // Handle cursor pagination (future enhancement)
  if (query.cursor) {
    result.cursor = query.cursor
  }

  return result
}
