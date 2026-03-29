# Fields & Widgets

## `FieldConfig`

Defines a single form field in `formFields.create` or `formFields.edit`:

```ts
interface FieldConfig {
  name: string                         // Drizzle column name
  label?: string                       // Display label (auto-generated if omitted)
  widget?: WidgetType                  // Auto-detected from column type if omitted
  required?: boolean
  readonly?: boolean
  help?: string                        // Help text below the field
  placeholder?: string
  options?: WidgetOptions              // Widget-specific configuration
  validation?: any                     // Additional validation rules
  condition?: (formData: any) => boolean  // Show/hide based on other field values
}
```

---

## Widget Types

```ts
type WidgetType =
  | 'TextInput'
  | 'NumberInput'
  | 'TextareaInput'
  | 'CheckboxInput'
  | 'SelectInput'
  | 'DateTimePicker'
  | 'PasswordInput'
  | 'RelationSelect'
  | 'MultiRelationSelect'
  | 'FileUpload'
  | 'ImageUpload'
  | 'RichTextEditor'
  | 'MarkdownEditor'
  | 'CodeEditor'
  | 'ColorPicker'
  | 'JsonEditor'
  | 'TagsInput'
  | 'SlugInput'
```

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
  displayField?: string     // field to show in dropdown (default: 'name' or 'title')
  searchFields?: string[]   // fields to search when typing
}
```

```ts
{ name: 'authorId', widget: 'RelationSelect', options: {
  resource: 'users',
  displayField: 'name',
  searchFields: ['name', 'email'],
}}
```

### `MultiRelationSelect` — M2M

```ts
options: {
  resource: string
  displayField?: string
  searchFields?: string[]
  junctionTable?: string    // if M2M via junction
  junctionLeftKey?: string
  junctionRightKey?: string
}
```

```ts
{ name: 'tags', widget: 'MultiRelationSelect', options: {
  resource: 'tags',
  displayField: 'name',
  junctionTable: 'post_tags',
  junctionLeftKey: 'postId',
  junctionRightKey: 'tagId',
}}
```

### `NumberInput`

```ts
options: { min?: number; max?: number; step?: number }
```

### `TextInput` / `TextareaInput`

```ts
options: { maxLength?: number; minLength?: number; rows?: number }
```

### `DateTimePicker`

```ts
options: { format?: string; showTime?: boolean }
```

### `FileUpload` / `ImageUpload`

```ts
options: { accept?: string; maxSize?: number; multiple?: boolean }
// e.g. accept: 'image/*', maxSize: 5_000_000
```

### `SlugInput`

Auto-generates a slug from another field.

```ts
options: { generateFrom: 'title' }   // watches 'title' field and generates slug
```

### `RichTextEditor`

```ts
options: { toolbar?: string[] }
```

### `CodeEditor`

```ts
options: { language?: 'typescript' | 'json' | 'sql' | string; theme?: string }
```

---

## Auto-Widget Selection

When `widget` is not specified, nuxt-auto-admin maps Drizzle column types automatically:

| Column type / pattern | Widget |
|-----------------------|--------|
| FK column (`*Id`) | `RelationSelect` |
| Enum column | `SelectInput` (with enum values) |
| `password`, `*hash*`, `*secret*` | `PasswordInput` |
| Boolean | `CheckboxInput` |
| Integer/numeric | `NumberInput` |
| Date/timestamp | `DateTimePicker` |
| Large text (TEXT, `*content*`, `*body*`, `*description*`) | `TextareaInput` |
| JSON/jsonb | `JsonEditor` |
| Default | `TextInput` |

---

## Conditional Fields

Show or hide a field based on other form values:

```ts
formFields: {
  create: [
    { name: 'type', widget: 'SelectInput',
      options: { options: [
        { label: 'Article', value: 'article' },
        { label: 'Video', value: 'video' },
      ]}},
    { name: 'videoUrl', widget: 'TextInput',
      condition: (data) => data.type === 'video' },
    { name: 'readingTime', widget: 'NumberInput',
      condition: (data) => data.type === 'article' },
  ]
}
```

---

## Hidden & Readonly Fields

```ts
resources: {
  posts: {
    hiddenFields: ['deletedAt', 'internalScore'],   // excluded from list + form
    readonlyFields: ['createdAt', 'updatedAt', 'slug'],  // shown but not editable
  }
}
```

Common auto-hidden fields: primary key (unless it's the only identifier), standard audit timestamps when `readonlyFields` applies.
