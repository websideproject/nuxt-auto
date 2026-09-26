export interface ListPage<T> {
  data: T[]
  meta?: { nextCursor?: string }
}

/**
 * Every row of a list, page after page by keyset cursor (the first page sends an empty cursor), stopping at
 * `maxRows`. `truncated` says the list had more.
 */
export async function collectRows<T>(
  fetchPage: (cursor: string, limit: number) => Promise<ListPage<T>>,
  pageSize: number,
  maxRows: number,
): Promise<{ rows: T[], truncated: boolean }> {
  const rows: T[] = []
  let cursor = ''
  while (rows.length < maxRows) {
    const page = await fetchPage(cursor, Math.min(pageSize, maxRows - rows.length))
    rows.push(...page.data)
    if (!page.meta?.nextCursor) return { rows, truncated: false }
    cursor = page.meta.nextCursor
  }
  return { rows, truncated: true }
}
