/** An item a bulk request failed on (`data.errors` of a transactional 400, or `meta.errors` of a partial success). */
export interface BulkItemError {
  index?: number
  id?: string | number
  error: string
}

interface FetchErrorLike {
  statusCode?: number
  status?: number
  response?: { status?: number }
  message?: string
  data?: { message?: string, statusMessage?: string, data?: { errors?: unknown } }
}

/** The HTTP status of a failed API call. */
export function apiStatus(error: unknown): number | undefined {
  const e = error as FetchErrorLike | undefined
  return e?.statusCode ?? e?.status ?? e?.response?.status
}

/** The API's own message for a failed call (its error body), else the fetch error's. */
export function apiErrorMessage(error: unknown): string {
  const e = error as FetchErrorLike | undefined
  return e?.data?.message || e?.data?.statusMessage || e?.message || 'Request failed'
}

/**
 * The failing items a bulk route names in its 400 (`data.errors`): the handler's `{ index, id?, error }`, or the
 * request validation's issues, whose `path` is `['items', <index>, <field>]`.
 */
export function bulkItemErrors(error: unknown): BulkItemError[] {
  const errors = (error as FetchErrorLike | undefined)?.data?.data?.errors
  if (!Array.isArray(errors)) return []
  return errors.flatMap((e): BulkItemError[] => {
    if (e && typeof e.error === 'string') return [e]
    if (!e || typeof e.message !== 'string' || !Array.isArray(e.path)) return []
    const [list, index, ...field] = e.path
    if (list === 'items' && typeof index === 'number') return [{ index, error: field.length ? `${field.join('.')}: ${e.message}` : e.message }]
    return [{ error: e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message }]
  })
}

/**
 * "Item 3 (id 17): message" — `offset` turns a batch index into a position in the whole list. A D1 batch that
 * fails as a whole names no item: then only the message.
 */
export function describeItemError(item: BulkItemError, offset = 0, noun = 'Item'): string {
  if (typeof item.index !== 'number') return item.error
  return `${noun} ${item.index + offset + 1}${item.id !== undefined ? ` (id ${item.id})` : ''}: ${item.error}`
}
