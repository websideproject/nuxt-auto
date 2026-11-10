import { describe, it, expectTypeOf } from 'vitest'
import type { InfiniteData } from '@tanstack/vue-query'
import type { useAutoApiGet, useAutoApiInfinite, useAutoApiList, ListResponse, GetResponse } from '../../src/runtime/composables/useAutoApiQuery'
import type { AggregateResponse, useAutoApiAggregate } from '../../src/runtime/composables/useAutoApiAggregate'
import type { useM2MRelation } from '../../src/runtime/composables/useM2MRelation'
import type { AutoApiRow, AutoApiRowOf } from '../../src/runtime/types/rows'

// Compile-time checks, enforced by `bun run typecheck`: the composables must hand users TYPED data. They used to
// return `useQuery({ … } as any)`, which typed `data` as `{}` — `data.value.data` was a type error in user code.
interface Post { id: number, title: string }

// What `autoApi.typedRows` generates, for one resource of this test only.
declare global {
  interface AutoApiResourceRows {
    typedRowsTestPosts: AutoApiRow<{ $inferSelect: { id: number, title: string, passwordHash: string, createdAt: Date, meta: { at: Date }[] } }, 'passwordHash'>
  }
}

describe('composable result types', () => {
  it('useAutoApiList / useAutoApiGet / useAutoApiInfinite carry the row type', () => {
    expectTypeOf<ReturnType<typeof useAutoApiList<Post>>['data']['value']>().toEqualTypeOf<ListResponse<Post> | undefined>()
    expectTypeOf<ReturnType<typeof useAutoApiGet<Post>>['data']['value']>().toEqualTypeOf<GetResponse<Post> | undefined>()
    expectTypeOf<ReturnType<typeof useAutoApiInfinite<Post>>['data']['value']>().toEqualTypeOf<InfiniteData<ListResponse<Post>> | undefined>()
  })

  it('useAutoApiAggregate and useM2MRelation are typed too', () => {
    expectTypeOf<ReturnType<typeof useAutoApiAggregate<AggregateResponse>>['data']['value']>().toEqualTypeOf<AggregateResponse | undefined>()
    expectTypeOf<NonNullable<ReturnType<typeof useM2MRelation<Post>>['data']['value']>>().toHaveProperty('ids')
  })

  it('a registered resource types its rows: JSON dates, no hidden fields; anything else stays any', () => {
    type Row = AutoApiRowOf<never, 'typedRowsTestPosts'>
    expectTypeOf<Row>().toEqualTypeOf<{ id: number, title: string, createdAt: string, meta: { at: string }[] }>()
    expectTypeOf<ReturnType<typeof useAutoApiList<never, 'typedRowsTestPosts'>>['data']['value']>().toEqualTypeOf<ListResponse<Row> | undefined>()
    expectTypeOf<AutoApiRowOf<never, 'notRegistered'>>().toBeAny()
    expectTypeOf<AutoApiRowOf<never, string>>().toBeAny()
    expectTypeOf<AutoApiRowOf<Post, 'typedRowsTestPosts'>>().toEqualTypeOf<Post>()
  })

  it('params accept a computed that may be undefined', () => {
    expectTypeOf<import('vue').ComputedRef<{ limit: number } | undefined>>().toMatchTypeOf<Parameters<typeof useAutoApiList>[1]>()
  })
})
