<template>
  <FileUpload
    v-bind="$props"
    image
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import type { WidgetOptions } from '../../types'
import FileUpload from './FileUpload.vue'

defineProps<{
  modelValue?: string | null
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
  fieldName?: string
  resourceName?: string
  recordId?: string | number
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()
</script>
