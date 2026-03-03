<template>
  <UTextarea
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="readonly"
    :required="required"
    :rows="options?.rows || 4"
    class="w-full"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import type { WidgetOptions } from '../../types'

defineProps<{
  modelValue?: string
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
