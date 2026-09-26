function escapeCsvValue(value: unknown): string {
  if (value == null) return ''
  let str = typeof value === 'object' && !(value instanceof Date) ? JSON.stringify(value) : String(value)
  // A cell starting with = + - @ (or a tab / CR) is run as a formula by spreadsheet apps: neutralise it.
  // (The same rule as nuxt-auto-api's export route, so both exports read alike.)
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Rows as CSV (RFC 4180 quoting), columns = `fields` or the first row's keys. */
export function toCsv(rows: Record<string, unknown>[], fields?: string[]): string {
  if (rows.length === 0) return ''
  const columns = fields?.length ? fields : Object.keys(rows[0]!)
  const header = columns.map(escapeCsvValue).join(',')
  const lines = rows.map(row => columns.map(col => escapeCsvValue(row[col])).join(','))
  return [header, ...lines].join('\r\n')
}

/**
 * Parse CSV text (RFC 4180: quoted cells may hold commas, `""` and line breaks; CRLF or LF rows) into rows of
 * cells. A leading byte-order mark is dropped and blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let i = text.charCodeAt(0) === 0xFEFF ? 1 : 0

  const endRow = () => {
    row.push(cell)
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
    cell = ''
  }

  for (; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        }
        else {
          quoted = false
        }
      }
      else {
        cell += ch
      }
    }
    else if (ch === '"' && cell === '') {
      quoted = true
    }
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRow()
    }
    else {
      cell += ch
    }
  }
  if (cell !== '' || row.length) endRow()
  return rows
}

/** Save `content` as a file in the browser. */
export function downloadFile(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
