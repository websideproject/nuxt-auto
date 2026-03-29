# Mutation Composables

All mutation composables auto-invalidate the relevant cache keys on success.

---

## `useAutoApiMutation` — Unified API (recommended)

Dispatches to create/update/delete based on the `action` parameter.

```ts
const mutation = useAutoApiMutation<Post, CreatePostBody>(
  'posts',
  'create',    // 'create' | 'update' | 'delete'
  options?
)

mutation.mutate(body)
await mutation.mutateAsync(body)
```

---

## `useAutoApiCreate<T, TBody>` — Create

```ts
const { mutate, mutateAsync, isPending, error } = useAutoApiCreate<Post, CreatePostBody>(
  'posts',
  options?    // UseMutationOptions & { toast?: AutoApiToastOptions }
)

// Usage
mutate({ title: 'Hello', status: 'draft' })

// With toast feedback
useAutoApiCreate('posts', {
  toast: { enabled: true, showSuccess: true, showErrors: true },
  onSuccess: (result) => navigateTo(`/posts/${result.data.id}`),
})
```

Auto-invalidates: `['autoapi', 'posts', 'list', *]`

---

## `useAutoApiUpdate<T, TBody>` — Update

```ts
const { mutate, isPending } = useAutoApiUpdate<Post, UpdatePostBody>('posts', options?)

// Must include `id` in the mutation variables
mutate({ id: 1, title: 'Updated', status: 'published' })
```

Auto-invalidates: `['autoapi', 'posts', 'get', id, *]` and `['autoapi', 'posts', 'list', *]`

---

## `useAutoApiDelete` — Delete

```ts
const { mutate, isPending } = useAutoApiDelete('posts', options?)

mutate(postId)   // string | number
```

Auto-removes: `['autoapi', 'posts', 'get', id, *]` and invalidates list.

---

## Toast Options

```ts
interface AutoApiToastOptions {
  enabled?: boolean
  showSuccess?: boolean
  showErrors?: boolean
}
```

Requires `@nuxt/ui` `useToast()` available in the app.

---

## Bulk Operations

### `useAutoApiBulkCreate<T, TBody>`

```ts
const { mutate } = useAutoApiBulkCreate<Post, CreatePostBody>('posts', options?)

mutate([
  { title: 'Post 1', status: 'draft' },
  { title: 'Post 2', status: 'draft' },
])
// Response: BulkOperationResponse<Post>
// { data: Post[], meta: { total, successful, failed, errors? } }
```

### `useAutoApiBulkUpdate<T, TBody>`

```ts
const { mutate } = useAutoApiBulkUpdate<Post, UpdatePostBody>('posts', options?)

mutate([
  { id: 1, status: 'published' },
  { id: 2, status: 'published' },
])
```

### `useAutoApiBulkDelete`

```ts
const { mutate } = useAutoApiBulkDelete('posts', options?)

mutate([1, 2, 3])
// Response: { success: boolean, deleted: number }
```

---

## Optimistic Updates

```ts
import { useAutoApiOptimisticUpdate } from '@websideproject/nuxt-auto-api'

// Inside onMutate callback
const { queryKey, previousData } = useAutoApiOptimisticUpdate<Post>(
  'posts',
  postId,
  { title: 'Optimistically updated' }
)

// Rollback on error
onError: () => {
  queryClient.setQueryData(queryKey, previousData)
}
```

---

## Response Types

```ts
// Single resource (create/update/get)
interface SingleResponse<T> {
  data: T
}

// Bulk operations
interface BulkOperationResponse<T> {
  data: T[]
  meta: {
    total: number
    successful: number
    failed: number
    errors?: Array<{ index: number; id?: string | number; error: string }>
  }
}
```
