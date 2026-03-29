# Query Composables

All query composables use **TanStack Query (Vue Query)** under the hood and are auto-imported. They cache responses and revalidate automatically.

---

## `useAutoApiList<T>` — Fetch a list

```ts
const { data, isLoading, error, refetch } = useAutoApiList<Post>(
  'posts',           // resource name (MaybeRef<string>)
  params?,           // MaybeRef<ListQueryParams>
  options?           // Vue Query UseQueryOptions
)
```

### `ListQueryParams`

```ts
interface ListQueryParams {
  filter?: Record<string, any>      // field equality or operator filters
  sort?: string | string[]          // field name, prefix '-' for descending
  page?: number                     // offset pagination page number
  limit?: number                    // items per page (default: 20, max: 100)
  cursor?: string                   // cursor pagination (instead of page)
  include?: string | string[]       // relation names to load
  fields?: string | string[]        // select only these fields
}
```

### Filtering examples

```ts
// Equality
filter: { status: 'published', authorId: 5 }

// Operators (server-side support varies)
filter: { price: { gt: 100, lte: 500 } }
filter: { title: { like: '%nuxt%' } }
filter: { tags: { in: ['vue', 'nuxt'] } }

// Null checks
filter: { deletedAt: null }
filter: { publishedAt: { not: null } }
```

### Sorting examples

```ts
sort: 'createdAt'           // ascending
sort: '-createdAt'          // descending
sort: ['-publishedAt', 'title']  // multi-sort
```

### Including relations

```ts
include: ['author', 'tags', 'category.parent']
```

### Return value (`ListResponse<T>`)

```ts
data.value = {
  data: T[],
  meta: {
    total?: number,
    page?: number,
    limit?: number,
    cursor?: string,
    nextCursor?: string,
    hasMore?: boolean,
  }
}
```

### Reactive params

```ts
const status = ref('published')
const { data } = useAutoApiList('posts', computed(() => ({
  filter: { status: status.value },
  sort: '-createdAt',
})))
// Re-fetches automatically when status.value changes
```

---

## `useAutoApiGet<T>` — Fetch single resource

```ts
const { data, isLoading, error } = useAutoApiGet<Post>(
  'posts',
  id,        // MaybeRef<string | number>
  params?,   // MaybeRef<{ include?: string|string[], fields?: string|string[] }>
  options?
)
```

```ts
// With relations
const { data } = useAutoApiGet('posts', postId, { include: ['author', 'comments'] })
// data.value = { data: Post & { author: User, comments: Comment[] } }
```

---

## `useAutoApiInfinite<T>` — Infinite scroll

Uses cursor-based pagination for infinite lists.

```ts
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
} = useAutoApiInfinite<Post>(
  'posts',
  params?,    // Omit<ListQueryParams, 'cursor'> — cursor is managed internally
  options?
)
```

```ts
// data.value = { pages: [ListResponse<Post>, ...] }
const allItems = computed(() =>
  data.value?.pages.flatMap(p => p.data) ?? []
)
```

---

## Cache Keys

TanStack Query cache keys (for manual invalidation):

```ts
['autoapi', resourceName, 'list', params]     // useAutoApiList
['autoapi', resourceName, 'get', id, params]  // useAutoApiGet
['autoapi', resourceName, 'infinite', params] // useAutoApiInfinite
```

Mutation composables automatically invalidate the relevant keys on success.
