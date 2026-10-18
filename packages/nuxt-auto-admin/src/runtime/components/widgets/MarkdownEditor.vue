<template>
  <RichTextEditor
    v-bind="$props"
    content-type="markdown"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import type { WidgetOptions } from '../../types'
import RichTextEditor from './RichTextEditor.vue'

defineProps<{
  modelValue?: string | null
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
