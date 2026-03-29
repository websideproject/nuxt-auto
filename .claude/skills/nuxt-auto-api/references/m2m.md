# Many-to-Many (M2M) Relations

M2M relationships are managed through junction tables. nuxt-auto-api auto-detects junction tables by convention, or they can be configured explicitly.

---

## M2M Configuration

```ts
autoApi: {
  m2m?: {
    autoDetect?: boolean    // default: true — detect junction tables automatically

    relations?: {
      // Manual config: posts.tags (junction: post_tags)
      posts: {
        tags: {
          junctionTable: 'post_tags',   // Drizzle schema export name
          leftKey: 'postId',            // FK → source resource
          rightKey: 'tagId',            // FK → related resource
          label?: 'Tags',
          help?: string,
          displayField?: 'name',        // field to show in UI
          metadataColumns?: ['order', 'addedAt'],  // extra junction columns
        },
      },
    },
  },
}
```

Junction table detection: a table with exactly two foreign keys and no other non-FK columns is treated as a junction table.

---

## M2M Endpoints (auto-generated)

```
GET    /api/{resource}/:id/relations/{relation}           List related IDs (+ optional records)
POST   /api/{resource}/:id/relations/{relation}           Sync (replace all relations)
POST   /api/{resource}/:id/relations/{relation}/add       Add relations
DELETE /api/{resource}/:id/relations/{relation}/remove    Remove relations
POST   /api/{resource}/:id/relations/batch                Batch sync multiple relations
```

---

## `useM2MRelation<T>` — Query relations

```ts
const { data, isLoading } = useM2MRelation<Tag>(
  'posts',            // source resource
  postId,             // source ID
  'tags',             // relation name
  params?,            // M2MListQuery
  options?
)
```

### `M2MListQuery`

```ts
interface M2MListQuery {
  includeRecords?: boolean | string    // include full records (not just IDs)
  includeMetadata?: boolean | string   // include junction table metadata columns
  fields?: string | string[]           // select fields from related records
  filter?: Record<string, any>         // filter related records
  sort?: string | string[]
  limit?: number
  offset?: number
}
```

### `M2MListResponse<T>`

```ts
interface M2MListResponse<T> {
  ids: Array<string | number>   // always present
  records?: T[]                 // present when includeRecords: true
  metadata?: Array<Record<string, any>>  // junction table extra columns
  total: number
  meta?: { limit?: number; offset?: number; hasMore?: boolean }
}
```

---

## `useM2MSync` — Replace all relations (sync)

Replaces the entire set of relations in one atomic operation.

```ts
const { mutate, isPending } = useM2MSync(
  'posts',
  postId,
  'tags',
  options?
)

mutate({
  ids: [1, 2, 3],           // new complete set of related IDs
  metadata?: [              // optional junction metadata per relation
    { order: 1, addedAt: new Date() },
    { order: 2, addedAt: new Date() },
    { order: 3, addedAt: new Date() },
  ],
  replace?: true,           // default: true
})
// Returns: M2MOperationResponse
```

Supports **optimistic updates** with automatic rollback on error.

---

## `useM2MAdd` — Append relations

Adds new relations without touching existing ones.

```ts
const { mutate } = useM2MAdd('posts', postId, 'tags', options?)

mutate({
  ids: [4, 5],
  metadata?: [{ order: 4 }, { order: 5 }],
})
```

---

## `useM2MRemove` — Remove relations

```ts
const { mutate } = useM2MRemove('posts', postId, 'tags', options?)

mutate({ ids: [2, 3] })
```

---

## `useM2MBatchSync` — Sync multiple relations at once

Updates several M2M relations in a single request/transaction.

```ts
const { mutate } = useM2MBatchSync('posts', postId, options?)

mutate({
  relations: {
    tags:       { ids: [1, 2, 3] },
    categories: { ids: [5], metadata: [{ primary: true }] },
    authors:    { ids: [10, 11] },
  },
})
// Returns: M2MBatchSyncResponse
// { success, results: { tags: { added, removed, total }, ... } }
```

---

## `M2MOperationResponse`

```ts
interface M2MOperationResponse {
  success: boolean
  added?: number
  removed?: number
  total: number
  error?: string
}
```

---

## M2M in Authorization

```ts
authorization: {
  posts: {
    permissions: {
      m2m: {
        read:   'user',
        sync:   ['editor', 'admin'],
        add:    'editor',
        remove: 'editor',
      },
    },
  },
}
```

---

## M2M Detection Endpoints (for admin/tooling)

```
GET /api/_m2m/detect/:resource     Detect M2M relations for a resource
GET /api/_m2m/is-junction/:table   Check if a table is a junction table
GET /api/_m2m/junctions            List all detected junction tables
GET /api/_m2m/debug-detection      Debug M2M detection across all tables
```
