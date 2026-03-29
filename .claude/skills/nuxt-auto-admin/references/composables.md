# Admin Composables

All composables are auto-imported when `@websideproject/nuxt-auto-admin` is registered.

---

## `useAdminConfig` — Runtime config access

```ts
const config = useAdminConfig()
// Returns:
{
  prefix: string
  branding: { title?: string; logo?: string; favicon?: string }
  permissions: {
    unauthorizedButtons: 'hide' | 'disable'
    unauthorizedSidebarItems: 'hide' | 'disable'
  }
  features: {
    bulkActions: boolean
    search: boolean
    filters: boolean
    export: boolean
    import: boolean
    auditLog: boolean
  }
  ui: { editMode: 'modal' | 'page'; viewMode: 'modal' | 'page' }
}
```

---

## `useAdminRegistry` — All registered resources

```ts
const {
  registry,              // Ref<Record<string, ResourceSchema>>
  allResources,          // Ref<ResourceSchema[]>
  getResource,           // (name: string) => ResourceSchema | undefined
  getResourcesByGroup,   // Ref<Record<string, ResourceSchema[]>>
  isLoading,             // Ref<boolean>
} = useAdminRegistry()
```

### `ResourceSchema`

The introspected + configured schema for a resource:

```ts
interface ResourceSchema {
  name: string
  displayName: string
  icon: string
  columns: ColumnMetadata[]        // introspected from Drizzle table
  relations?: RelationMetadata[]
  primaryKey: string
  listFields: string[]
  formFields: { create: FieldConfig[]; edit: FieldConfig[] }
  hiddenFields: string[]
  readonlyFields: string[]
  actions: Record<string, CustomAction>
  group?: string
  order?: number
  disabled?: boolean
  type: 'resource' | 'junction'
}
```

---

## `useAdminResource` — Single resource schema

```ts
const {
  resource,    // Ref<ResourceSchema | undefined>
  isLoading,
} = useAdminResource('posts')
```

---

## `useAdminPermissions` — CRUD permission flags

Wraps `usePermissions` from `nuxt-auto-api` with admin-specific helpers.

```ts
const {
  permissions,              // Ref<ResourcePermissions | undefined>
  canCreate,                // Ref<boolean>
  canRead,                  // Ref<boolean>
  canUpdate,                // Ref<boolean>
  canDelete,                // Ref<boolean>
  hasAnyPermission,         // Ref<boolean>
  isLoading,
  getPermissionDeniedMessage,  // (action) => string
} = useAdminPermissions('posts')
```

Use with `autoAdmin.permissions.unauthorizedButtons` to conditionally disable/hide UI controls.

---

## `useAdminActions` — Navigation helpers

```ts
const {
  goToList,                // () => navigateTo('/admin/posts')
  goToDetail,              // (id) => navigateTo('/admin/posts/:id')
  goToCreate,              // () => navigateTo('/admin/posts/new')
  goToEdit,                // (id) => navigateTo('/admin/posts/:id/edit')
  handleDelete,            // async (id, { redirect? }) => void
  isDeleting,              // Ref<boolean>
} = useAdminActions('posts')
```

`handleDelete` calls `useAutoApiDelete` internally, shows a confirmation toast, and optionally redirects to the list after deletion.

---

## `useResourceForm` — Form field generation

```ts
const {
  fields,         // Ref<FieldConfig[]>  — resolved form fields for the mode
  initialData,    // Ref<Record<string, any>>  — default values
  isLoading,
  resource,       // Ref<ResourceSchema | undefined>
} = useResourceForm('posts', 'create')  // 'create' | 'edit'
```

Use this to render a custom form outside `<ResourceForm>`:

```vue
<script setup>
const { fields, initialData, isLoading } = useResourceForm('posts', 'create')
const create = useAutoApiCreate('posts')
</script>

<template>
  <AutoForm
    v-if="!isLoading"
    :fields="fields"
    :initial-data="initialData"
    @submit="create.mutate($event)"
  />
</template>
```

---

## `useM2MDetection` — M2M relationship helpers

```ts
const {
  detectM2MFields,     // async (resourceName: string) => M2MFieldConfig[]
  mergeM2MFields,      // (auto: M2MFieldConfig[], manual?: FieldConfig[]) => FieldConfig[]
  formatLabel,         // (resourceName: string) => string
} = useM2MDetection()

// Standalone helpers
const isJunction = await isJunctionTable('post_tags')    // boolean
const junctions  = await getJunctionTableNames()          // string[]
```

`detectM2MFields` queries `GET /api/_m2m/detect/:resource` to find M2M relations and returns them as `FieldConfig[]` with `MultiRelationSelect` widgets pre-configured.
