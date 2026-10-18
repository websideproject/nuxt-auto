import { describe, it, expect } from 'vitest'
import { chartBars, formatStat, widgetAggregate, widgetSpan } from '../../../src/runtime/utils/dashboard'

describe('dashboard widgets', () => {
  it('read the aggregate they ask for', () => {
    expect(widgetAggregate({ type: 'stat' })).toEqual({ aggregate: 'count', key: 'count' })
    expect(widgetAggregate({ type: 'stat', aggregation: 'sum', field: 'total' })).toEqual({ aggregate: 'sum(total)', key: 'sum_total' })
    // sum without a field falls back to count
    expect(widgetAggregate({ type: 'stat', aggregation: 'sum' })).toEqual({ aggregate: 'count', key: 'count' })
  })

  it('take a span of the 12-column grid', () => {
    expect([widgetSpan({ type: 'stat' }), widgetSpan({ type: 'chart' }), widgetSpan({ type: 'custom' }), widgetSpan({ type: 'stat', span: 20 })]).toEqual([3, 6, 12, 12])
  })

  it('chart bars: largest first, or in time order for date buckets', () => {
    const rows = [{ group: { status: 'draft' }, count: 2 }, { group: { status: 'live' }, count: 8 }, { group: { status: null }, count: 1 }]
    expect(chartBars(rows, 'count')).toEqual([
      { label: 'live', value: 8, share: 1 },
      { label: 'draft', value: 2, share: 0.25 },
      { label: '—', value: 1, share: 0.125 },
    ])
    const months = [{ group: { createdAt_month: '2026-01' }, count: 3 }, { group: { createdAt_month: '2026-02' }, count: 6 }, { group: { createdAt_month: '2026-03' }, count: 1 }]
    expect(chartBars(months, 'count', 2).map(b => b.label)).toEqual(['2026-02', '2026-03'])
  })

  it('formats stat values', () => {
    expect(formatStat(12345)).toBe((12345).toLocaleString())
    expect(formatStat(1.23456)).toBe((1.23).toLocaleString())
    expect(formatStat(null)).toBe('—')
  })
})

describe('dashboard components module', () => {
  it('lazy-loads the dashboard component and custom widgets by position', async () => {
    const { dashboardModule } = await import('../../../src/module')
    const code = dashboardModule('/app/Dash.vue', { 2: '/app/Widget.vue' })
    expect(code).toContain('export const dashboardComponent = defineAsyncComponent(() => import("/app/Dash.vue"))')
    expect(code).toContain('2: defineAsyncComponent(() => import("/app/Widget.vue"))')
    expect(dashboardModule(null, {})).toContain('export const dashboardComponent = null')
  })
})
