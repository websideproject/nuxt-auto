<template>
  <USelectMenu
    :model-value="modelValue"
    :options="selectOptions"
    :disabled="readonly"
    :required="required"
    :placeholder="placeholder || 'Select an option'"
    class="w-full"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetOptions } from '../../types'

const props = defineProps<{
  modelValue?: string | number
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const selectOptions = computed(() => {
  // If options are provided directly
  if (props.options?.options) {
    return props.options.options
  }

  // If enum values are provided
  if (props.options?.enumValues) {
    return props.options.enumValues.map((value) => ({
      label: value,
      value: value,
    }))
  }

  return []
})
</script>
