<template>
  <UFormField
    class="admin-field"
    :data-field="field.name"
    :name="field.name"
    :label="field.label || formatFieldLabel(field.name)"
    :required="field.required"
    :help="field.help"
    :error="error"
  >
    <component
      :is="widgetComponent"
      :model-value="modelValue"
      :placeholder="field.placeholder"
      :readonly="field.readonly"
      :required="field.required"
      :options="field.options"
      :disabled="disabled || field.readonly"
      v-bind="contextProps"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </UFormField>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue'
import type { FieldConfig } from '../types'
import { formatFieldLabel } from '../utils/fieldTypeMapping'

const props = defineProps<{
  field: FieldConfig
  modelValue: unknown
  error?: string
  disabled?: boolean
  /** The whole form's values (SlugInput follows `generateFrom`) */
  formData?: Record<string, unknown>
  /** The record the form edits (upload widgets need it) */
  resourceName?: string
  recordId?: string | number
}>()

defineEmits<{
  'update:modelValue': [value: unknown]
}>()

// Static import map for all widget components
const widgetComponentMap: Record<string, () => Promise<Component>> = {
  TextInput: () => import('./widgets/TextInput.vue'),
  NumberInput: () => import('./widgets/NumberInput.vue'),
  TextareaInput: () => import('./widgets/TextareaInput.vue'),
  CheckboxInput: () => import('./widgets/CheckboxInput.vue'),
  SelectInput: () => import('./widgets/SelectInput.vue'),
  DateTimePicker: () => import('./widgets/DateTimePicker.vue'),
  PasswordInput: () => import('./widgets/PasswordInput.vue'),
  RelationSelect: () => import('./widgets/RelationSelect.vue'),
  MultiRelationSelect: () => import('./widgets/MultiRelationSelect.vue'),
  SlugInput: () => import('./widgets/SlugInput.vue'),
  RichTextEditor: () => import('./widgets/RichTextEditor.vue'),
  MarkdownEditor: () => import('./widgets/MarkdownEditor.vue'),
  CodeEditor: () => import('./widgets/CodeEditor.vue'),
  JsonEditor: () => import('./widgets/JsonEditor.vue'),
  ColorPicker: () => import('./widgets/ColorPicker.vue'),
  TagsInput: () => import('./widgets/TagsInput.vue'),
  FileUpload: () => import('./widgets/FileUpload.vue'),
  ImageUpload: () => import('./widgets/ImageUpload.vue'),
}

// Props only some widgets take — bound only on those, so they never fall through as HTML attributes.
const contextProps = computed(() => {
  switch (props.field.widget) {
    case 'SlugInput':
      return { formData: props.formData }
    case 'FileUpload':
    case 'ImageUpload':
      return { fieldName: props.field.name, resourceName: props.resourceName, recordId: props.recordId }
    default:
      return {}
  }
})

// Dynamically load widget component based on field configuration
const widgetComponent = computed(() => {
  const widgetName = props.field.widget || 'TextInput'
  const componentLoader = widgetComponentMap[widgetName]

  if (!componentLoader) {
    console.warn(`Widget "${widgetName}" not found, falling back to TextInput`)
    return defineAsyncComponent(widgetComponentMap.TextInput!)
  }

  return defineAsyncComponent(componentLoader)
})
</script>
