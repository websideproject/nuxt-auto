import type { DashboardWidget } from '../types'

/** The `aggregate` expression and the result key a stat or chart widget reads (`count`, `sum_total`). */
export function widgetAggregate(widget: DashboardWidget): { aggregate: string, key: string } {
  const fn = widget.aggregation ?? 'count'
  if (fn === 'count' || !widget.field) return { aggregate: 'count', key: 'count' }
  return { aggregate: `${fn}(${widget.field})`, key: `${fn}_${widget.field}` }
}

/** Grid columns (of 12) a widget takes. */
export function widgetSpan(widget: DashboardWidget): number {
  const span = widget.span ?? (widget.type === 'stat' ? 3 : widget.type === 'custom' ? 12 : 6)
  return Math.min(12, Math.max(1, Math.round(span)))
}

/** A chart's bars from an aggregate response: label, value and share of the largest, largest first, at most `limit`. */
export function chartBars(rows: Array<Record<string, any>>, key: string, limit = 10): Array<{ label: string, value: number, share: number }> {
  const bars = rows.map((row) => {
    const group = row.group ?? {}
    const label = Object.values(group).map(v => (v === null || v === undefined ? '—' : String(v))).join(' · ') || '—'
    return { label, value: Number(row[key] ?? 0) }
  })
  // Date buckets read in time order; other groups largest first
  const timeline = rows.some(row => Object.keys(row.group ?? {}).some(k => /_(?:hour|day|week|month|year)$/.test(k)))
  const sorted = timeline ? bars : [...bars].sort((a, b) => b.value - a.value)
  const shown = timeline ? sorted.slice(-limit) : sorted.slice(0, limit)
  const max = Math.max(1, ...shown.map(b => b.value))
  return shown.map(b => ({ ...b, share: b.value / max }))
}

/** Format a stat value: integers grouped (12,345), others to two decimals. */
export function formatStat(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
