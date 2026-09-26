function escapeCsvValue(value: any): string {
  if (value == null) return ''
  let str = typeof value === 'object' && !(value instanceof Date) ? JSON.stringify(value) : String(value)
  // A cell starting with = + - @ (or a tab / CR) is run as a formula by spreadsheet apps: neutralise it.
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Rows as CSV (RFC 4180 quoting), columns = `fields` or the first row's keys. */
export function toCsv(data: any[], fields?: string[]): string {
  if (data.length === 0) return ''
  const columns = fields?.length ? fields : Object.keys(data[0])
  const header = columns.map(escapeCsvValue).join(',')
  const rows = data.map(row => columns.map(col => escapeCsvValue(row[col])).join(','))
  return [header, ...rows].join('\r\n')
}
