<template>
  <UFormField
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
  modelValue: any
  error?: string
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: any]
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
}

// Dynamically load widget component based on field configuration
const widgetComponent = computed(() => {
  const widgetName = props.field.widget || 'TextInput'
  const componentLoader = widgetComponentMap[widgetName]

  if (!componentLoader) {
    console.warn(`Widget "${widgetName}" not found, falling back to TextInput`)
    return defineAsyncComponent(widgetComponentMap.TextInput)
  }

  return defineAsyncComponent(componentLoader)
})
</script>
