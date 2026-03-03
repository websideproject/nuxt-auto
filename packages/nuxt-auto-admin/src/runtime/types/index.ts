import type { ResourceAuthConfig, ResourceHooks, ValidationSchema } from '@websideproject/nuxt-auto-api/runtime/types'

/**
 * Admin panel module options
 */
export interface ModuleOptions {
  /**
   * Admin panel route prefix
   * @default '/admin'
   */
  prefix?: string

  /**
   * Access control function - determines who can access admin panel
   * @default undefined (no access control)
   */
  access?: (user: any) => boolean | Promise<boolean>

  /**
   * Branding configuration
   */
  branding?: {
    /**
     * Logo URL or path
     */
    logo?: string
    /**
     * Admin panel title
     */
    title?: string
    /**
     * Favicon URL or path
     */
    favicon?: string
  }

  /**
   * Resource configurations
   * If not specified, all registered resources will be auto-configured
   */
  resources?: Record<string, ResourceConfig>

  /**
   * Dashboard configuration
   */
  dashboard?: DashboardConfig

  /**
   * Theme configuration
   */
  theme?: ThemeConfig

  /**
   * Custom pages/links to add to sidebar navigation
   */
  customPages?: CustomPageConfig[]

  /**
   * Enable/disable features
   */
  features?: {
    bulkActions?: boolean
    search?: boolean
    filters?: boolean
    export?: boolean
    import?: boolean
    auditLog?: boolean
  }

  /**
   * Permission handling behavior
   */
  permissions?: {
    /**
     * How to handle buttons when user lacks permission
     * @default 'disable'
     */
    unauthorizedButtons?: 'hide' | 'disable'

    /**
     * How to handle sidebar items when user lacks permission
     * @default 'hide'
     */
    unauthorizedSidebarItems?: 'hide' | 'disable'
  }

  /**
   * User interface preferences
   */
  ui?: {
    /**
     * How to open resource edit/view forms
     * - 'modal': Open in modal/drawer overlay (good for quick edits)
     * - 'page': Navigate to dedicated page (good for complex forms with M2M relations)
     * @default 'modal'
     */
    editMode?: 'modal' | 'page'

    /**
     * Same as editMode but for viewing resources
     * @default 'modal'
     */
    viewMode?: 'modal' | 'page'
  }
}

/**
 * Custom page configuration for sidebar navigation
 */
export interface CustomPageConfig {
  /**
   * Unique identifier for the page
   */
  name: string
  /**
   * Display label in sidebar
   */
  label: string
  /**
   * Route path (relative to admin prefix or absolute)
   */
  path: string
  /**
   * Icon for the page (Nuxt UI icon name)
   */
  icon: string
  /**
   * Optional group to categorize the page
   */
  group?: string
  /**
   * Order within the group or in the ungrouped section
   */
  order?: number
  /**
   * Required permissions to access this page
   * Can be a single permission string or an array of permissions
   * If array, user needs ALL permissions (AND logic)
   */
  permissions?: string | string[]
  /**
   * Permission check function for more complex logic
   */
  canAccess?: (user: any) => boolean | Promise<boolean>
}

/**
 * Resource configuration for admin UI
 */
export interface ResourceConfig {
  /**
   * Display name for the resource (used in sidebar, headers)
   */
  displayName?: string

  /**
   * Icon for the resource (Nuxt UI icon name)
   */
  icon?: string

  /**
   * Fields to show in list view
   * If not specified, will be auto-generated from schema
   */
  listFields?: string[]

  /**
   * Form field configurations
   */
  formFields?: {
    /**
     * Fields for create form
     */
    create?: FieldConfig[]
    /**
     * Fields for edit form (defaults to create if not specified)
     */
    edit?: FieldConfig[]
  }

  /**
   * Fields to hide from all views
   */
  hiddenFields?: string[]

  /**
   * Fields that are readonly (show but can't edit)
   */
  readonlyFields?: string[]

  /**
   * Custom actions for this resource
   */
  actions?: Record<string, CustomAction>

  /**
   * Disable the resource in admin panel
   */
  disabled?: boolean

  /**
   * Group name for organizing resources in sidebar
   */
  group?: string

  /**
   * Order in the sidebar
   */
  order?: number

  /**
   * Resource type - determines how it's displayed and handled
   * - 'resource': Regular resource (default) - shows in sidebar, has full CRUD pages
   * - 'junction': M2M junction table - hidden from sidebar, managed through relations
   * @default 'resource'
   */
  type?: 'resource' | 'junction'
}

/**
 * Field configuration for forms
 */
export interface FieldConfig {
  /**
   * Field name (must match schema column name)
   */
  name: string

  /**
   * Display label
   */
  label?: string

  /**
   * Widget to use for this field
   */
  widget?: WidgetType

  /**
   * Is field required
   */
  required?: boolean

  /**
   * Is field readonly
   */
  readonly?: boolean

  /**
   * Help text to show below field
   */
  help?: string

  /**
   * Placeholder text
   */
  placeholder?: string

  /**
   * Widget-specific options
   */
  options?: WidgetOptions

  /**
   * Validation rules
   */
  validation?: any

  /**
   * Conditional visibility based on other field values
   */
  condition?: (formData: any) => boolean
}

/**
 * Available widget types
 */
export type WidgetType =
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

/**
 * Widget-specific options
 */
export interface WidgetOptions {
  // SelectInput
  options?: Array<{ label: string; value: any }>
  enumValues?: string[]

  // RelationSelect
  resource?: string
  displayField?: string
  searchFields?: string[]

  // NumberInput
  min?: number
  max?: number
  step?: number

  // TextInput / TextareaInput
  maxLength?: number
  minLength?: number
  rows?: number

  // DateTimePicker
  format?: string
  showTime?: boolean

  // FileUpload / ImageUpload
  accept?: string
  maxSize?: number
  multiple?: boolean

  // SlugInput
  generateFrom?: string

  // RichTextEditor
  toolbar?: string[]

  // CodeEditor
  language?: string
  theme?: string

  // Any other custom options
  [key: string]: any
}

/**
 * Custom action configuration
 */
export interface CustomAction {
  /**
   * Action label/title
   */
  label: string

  /**
   * Icon for the action button
   */
  icon?: string

  /**
   * Action type
   */
  type: 'single' | 'bulk' | 'page-level'

  /**
   * Where the action appears
   */
  location: 'row' | 'toolbar' | 'detail'

  /**
   * Permission check for the action
   */
  permission?: (context: ActionContext) => boolean | Promise<boolean>

  /**
   * Action handler
   */
  handler: (item: any | any[], context: ActionContext) => Promise<void> | void

  /**
   * Confirmation message (if any)
   */
  confirm?: string | ((item: any | any[]) => string)

  /**
   * Button variant
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'link'

  /**
   * Button color
   */
  color?: string
}

/**
 * Action context passed to custom actions
 */
export interface ActionContext {
  user: any
  resource: string
  refresh: () => Promise<void>
  toast: any
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  /**
   * Dashboard widgets
   */
  widgets?: DashboardWidget[]

  /**
   * Custom dashboard component path
   */
  component?: string
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  type: 'stat' | 'chart' | 'activity' | 'custom'
  resource?: string
  label?: string
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max'
  filter?: Record<string, any>
  groupBy?: string
  limit?: number
  component?: string
  props?: Record<string, any>
  span?: number // Grid span (1-12)
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /**
   * Primary color
   */
  primaryColor?: string

  /**
   * Enable dark mode
   */
  darkMode?: boolean

  /**
   * Custom CSS
   */
  customCss?: string
}

/**
 * Introspected schema metadata for a resource
 */
export interface ResourceSchema {
  /**
   * Resource name
   */
  name: string

  /**
   * Display name (from config or generated)
   */
  displayName: string

  /**
   * Icon (from config or default)
   */
  icon: string

  /**
   * Table columns introspected from Drizzle schema
   */
  columns: ColumnMetadata[]

  /**
   * Relations introspected from schema
   */
  relations?: RelationMetadata[]

  /**
   * Primary key field name
   */
  primaryKey: string

  /**
   * Fields to show in list view (from config or auto-generated)
   */
  listFields: string[]

  /**
   * Form fields (from config or auto-generated)
   */
  formFields: {
    create: FieldConfig[]
    edit: FieldConfig[]
  }

  /**
   * Hidden fields
   */
  hiddenFields: string[]

  /**
   * Readonly fields
   */
  readonlyFields: string[]

  /**
   * Custom actions
   */
  actions: Record<string, CustomAction>

  /**
   * Authorization config
   */
  authorization?: ResourceAuthConfig

  /**
   * Validation schema
   */
  validation?: ValidationSchema

  /**
   * Hooks
   */
  hooks?: ResourceHooks

  /**
   * Group name
   */
  group?: string

  /**
   * Order
   */
  order?: number

  /**
   * Whether resource is disabled
   */
  disabled?: boolean

  /**
   * Resource type
   * @default 'resource'
   */
  type: 'resource' | 'junction'
}

/**
 * Column metadata from Drizzle schema introspection
 */
export interface ColumnMetadata {
  /**
   * Column name
   */
  name: string

  /**
   * Drizzle column type
   */
  type: string

  /**
   * SQL data type
   */
  dataType?: string

  /**
   * Is primary key
   */
  isPrimaryKey: boolean

  /**
   * Is auto-increment
   */
  isAutoIncrement: boolean

  /**
   * Is nullable
   */
  isNullable: boolean

  /**
   * Is unique
   */
  isUnique: boolean

  /**
   * Default value
   */
  defaultValue?: any

  /**
   * Enum values (for enum columns)
   */
  enumValues?: string[]

  /**
   * Foreign key reference
   */
  foreignKey?: {
    table: string
    column: string
  }

  /**
   * Column constraints
   */
  constraints?: string[]
}

/**
 * Relation metadata from Drizzle schema introspection
 */
export interface RelationMetadata {
  /**
   * Relation name
   */
  name: string

  /**
   * Relation type
   */
  type: 'one' | 'many'

  /**
   * Target resource name
   */
  target: string

  /**
   * Foreign key field in this table
   */
  foreignKey?: string

  /**
   * Reference field in target table
   */
  references?: string
}

/**
 * Admin registry - runtime access to resource schemas
 */
export interface AdminRegistry {
  resources: Record<string, ResourceSchema>
  getResource(name: string): ResourceSchema | undefined
  getAllResources(): ResourceSchema[]
  getResourcesByGroup(): Record<string, ResourceSchema[]>
}
