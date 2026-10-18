# Fields & Widgets

## `FieldConfig`

Defines a single form field in `formFields.create` or `formFields.edit`:

```ts
interface FieldConfig {
  name: string                         // Drizzle column name (property key)
  label?: string                       // Display label (auto-generated if omitted)
  widget?: WidgetType                  // Auto-detected from column type if omitted
  required?: boolean                   // Blocks an empty submit
  readonly?: boolean                   // Shown, left out of the request
  help?: string                        // Help text below the field
  placeholder?: string
  options?: WidgetOptions              // Widget-specific configuration
}
```

`formFields` lives in `nuxt.config`, which reaches the app as JSON: functions and `RegExp`s set there are lost.
Field functions go in `app/admin.fields.ts` (or `autoAdmin.fields`), merged onto the field of that name in both forms:

```ts
export default defineAdminFields({
  articles: {
    content: { condition: form => !!form.title },               // shown while true (hidden fields keep their value)
    slug: { validation: v => /^[a-z-]+$/.test(String(v)) || 'msg' }, // string/false = error; true/undefined = ok; may be async
  },
})
```

Validation is otherwise the API's — a refused save shows the API's error message.

`formFields` **replaces** the generated forms: always give `create` (the create form and import dialog use it;
`edit` falls back to it). Fields the caller may not write (`fields[x].write`) are made read-only automatically.

---

## Widget Types

Nine widgets exist:

```ts
type Widget =
  | 'TextInput'
  | 'NumberInput'
  | 'TextareaInput'
  | 'CheckboxInput'
  | 'SelectInput'
  | 'DateTimePicker'
  | 'PasswordInput'
  | 'RelationSelect'
  | 'MultiRelationSelect'
```

The `WidgetType` type also lists `FileUpload`, `ImageUpload`, `RichTextEditor`, `MarkdownEditor`, `CodeEditor`,
`ColorPicker`, `JsonEditor`, `TagsInput` and `SlugInput`, but they are **not implemented**: they render as
`TextInput` with a console warning. Don't use them.

---

## Widget Options (`WidgetOptions`)

### `SelectInput`

```ts
options: {
  options?: Array<{ label: string; value: any }>
  enumValues?: string[]     // Use enum values from Drizzle schema
}
```

```ts
{ name: 'status', widget: 'SelectInput', options: {
  options: [
    { label: 'Draft',     value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived',  value: 'archived' },
  ]
}}
```

### `RelationSelect` — FK/belongsTo

```ts
options: {
  resource: string          // nuxt-auto-api resource name
  displayField?: string     // field to show in dropdown (default: 'name')
  searchFields?: string[]   // only the FIRST entry is used to search (default: displayField)
}
```

```ts
{ name: 'authorId', widget: 'RelationSelect', options: {
  resource: 'users',
  displayField: 'name',
}}
```

### `MultiRelationSelect` — M2M

```ts
options: {
  resource: string
  displayField?: string
  searchFields?: string[]
  junctionTable?: string    // schema export name — a field with it is shown as an M2M card in the edit form
  junctionLeftKey?: string
  junctionRightKey?: string
}
```

```ts
{ name: 'tags', widget: 'MultiRelationSelect', options: {
  resource: 'tags',
  displayField: 'name',
  junctionTable: 'postTags',
  junctionLeftKey: 'postId',
  junctionRightKey: 'tagId',
}}
```

Relations the API's discovery reports (`m2m.relations`, or registered junctions) get cards without this.

### `NumberInput`

```ts
options: { min?: number; max?: number; step?: number }
```

### `TextareaInput`

```ts
options: { rows?: number }   // default 4
```

(`maxLength` / `minLength` are not applied by any widget.)

### `DateTimePicker`

```ts
options: { showTime?: boolean }   // default false; `format` is not read
```

---

## Auto-Widget Selection

When `widget` is not specified (first match wins):

| Column / pattern | Widget |
|-----------------------|--------|
| Foreign key | `RelationSelect` |
| Enum column | `SelectInput` (with enum values) |
| Name contains `password` | `PasswordInput` |
| Boolean, or integer named `is…` | `CheckboxInput` |
| Integer/numeric | `NumberInput` |
| Date/timestamp, or name ending `At` / `Date` | `DateTimePicker` |
| TEXT, or name containing `description`, `content`, `body`, `bio`, `notes` | `TextareaInput` |
| Anything else (JSON included) | `TextInput` |

Generated forms leave out the primary key, `createdAt`, `updatedAt` and `deletedAt`; on edit, columns ending in
`Id` (except `userId`) are read-only.

---

## Hidden Fields

```ts
resources: {
  posts: {
    hiddenFields: ['deletedAt', 'internalScore'],   // excluded from list + form
  }
}
```

The API's own hidden fields (registration `hiddenFields`, `autoApi.hiddenFields`) are hidden in the admin too.
For read-only fields use `readonly: true` in `formFields` (`readonlyFields` on a resource is not read).
