# Components Reference

All components are auto-imported when `@websideproject/nuxt-auto-admin` is registered.

---

## `<ResourceTable>` — Paginated list view

Auto-generates a searchable, sortable, paginated table for a resource using its introspected schema.

```vue
<ResourceTable
  resource-name="posts"
  :limit="25"
  :show-actions="true"
  edit-mode="modal"    <!-- 'modal' | 'page' -->
  view-mode="modal"
/>
```

Features: search bar, column sorting, row-level edit/delete/view buttons, bulk selection, bulk actions, export button (if `features.export: true`), permission-aware button visibility.

---

## `<ResourceForm>` — Schema-driven create/edit form

```vue
<!-- Create mode -->
<ResourceForm resource-name="posts" mode="create" />

<!-- Edit mode — loads existing record by ID -->
<ResourceForm resource-name="posts" mode="edit" :resource-id="postId" />

<!-- View mode — read-only display -->
<ResourceForm resource-name="posts" mode="view" :resource-id="postId" />
```

Renders all configured `formFields.create` (or `.edit`) fields, handles M2M fields automatically, shows validation errors, and handles submission.

---

## `<AutoForm>` — Generic form renderer

Lower-level form component. Takes an explicit `fields: FieldConfig[]` array rather than inferring from a resource name. Use when building custom forms.

```vue
<AutoForm
  :fields="myFields"
  :initial-data="{ title: '', status: 'draft' }"
  mode="create"              <!-- 'create' | 'edit' | 'view' -->
  :show-cancel="true"
  :show-reset="false"
  submit-label="Save Post"
  :disabled="isPending"
  @submit="handleSubmit"
  @cancel="handleCancel"
/>
```

**Props:**
- `fields: FieldConfig[]` — field definitions
- `initialData?: Record<string, any>` — pre-filled values
- `mode?: 'create' | 'edit' | 'view'` — default: `'create'`
- `showCancel?: boolean`
- `showReset?: boolean`
- `submitLabel?: string`
- `disabled?: boolean`

**Emits:**
- `submit(data: Record<string, any>)` — form values on valid submission
- `cancel()`

---

## `<AutoField>` — Single field widget renderer

Renders one field widget based on its `FieldConfig.widget` type.

```vue
<AutoField
  :field="{ name: 'title', label: 'Title', widget: 'TextInput', required: true }"
  v-model="formData.title"
  :error="errors.title"
  :disabled="isSubmitting"
/>
```

**Props:**
- `field: FieldConfig`
- `modelValue: any`
- `error?: string`
- `disabled?: boolean`

**Emits:**
- `update:modelValue(value: any)`

Use this to embed individual widgets in custom layouts.

---

## `<M2MRelationCard>` — M2M relationship editor

Dedicated card for managing a many-to-many relation. Renders a multi-select or searchable list of related items.

```vue
<M2MRelationCard
  resource-name="posts"
  :resource-id="postId"
  :relation="tagField"    <!-- FieldConfig with widget: 'MultiRelationSelect' -->
  :disabled="!canUpdate"
/>
```

---

## `<PermissionDeniedPage>` — 403 page

Shown automatically by the permissions middleware when a user lacks access to a resource. Can also be used manually:

```vue
<PermissionDeniedPage resource="posts" action="create" />
```

---

## Modal Components

Used internally by `<ResourceTable>` based on `editMode`/`viewMode` config. Can also be used directly.

### `<ResourceCreateModal>`

```vue
<ResourceCreateModal
  resource-name="posts"
  v-model:open="showCreateModal"
  @created="refetch()"
/>
```

### `<ResourceEditModal>`

```vue
<ResourceEditModal
  resource-name="posts"
  :resource-id="editingId"
  v-model:open="showEditModal"
  @updated="refetch()"
/>
```

### `<ResourceViewModal>`

```vue
<ResourceViewModal
  resource-name="posts"
  :resource-id="viewingId"
  v-model:open="showViewModal"
/>
```

---

## Layout Components

Rendered automatically by the admin layout but can be customized:

- **`<AdminHeader>`** — top bar with branding, user info, mobile sidebar toggle
- **`<AdminSidebar>`** — collapsible sidebar with resource groups, custom pages

---

## Widget Components (individual)

All widgets accept `modelValue`/`update:modelValue` + `disabled` + `error`. Available for direct use in custom admin pages:

| Component | Widget type |
|-----------|-------------|
| `<TextInput>` | text |
| `<NumberInput>` | number with min/max/step |
| `<TextareaInput>` | multi-line text |
| `<CheckboxInput>` | boolean |
| `<SelectInput>` | dropdown with static options |
| `<DateTimePicker>` | date/time |
| `<PasswordInput>` | masked password |
| `<RelationSelect>` | FK select via API search |
| `<MultiRelationSelect>` | M2M multi-select via API |
