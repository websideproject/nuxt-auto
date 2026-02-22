<template>
  <UInput
    type="number"
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="readonly"
    :required="required"
    :min="options?.min"
    :max="options?.max"
    :step="options?.step"
    class="w-full"
    @update:model-value="handleInput"
  />
</template>

<script setup lang="ts">
import type { WidgetOptions } from '../../types'

const props = defineProps<{
  modelValue?: number
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | undefined]
}>()

function handleInput(value: string) {
  const num = value === '' ? undefined : Number(value)
  emit('update:modelValue', num)
}
</script>
