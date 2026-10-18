<template>
  <UInputTags
    :model-value="tags"
    :placeholder="placeholder || 'Add a tag and press Enter'"
    :disabled="readonly"
    :required="required"
    :max="maxTags"
    add-on-paste
    add-on-blur
    class="w-full"
    @update:model-value="emitTags"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetOptions } from '../../types'
import { toTags } from '../../utils/widgetValues'

const props = defineProps<{
  modelValue?: string[] | string | null
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[] | string]
}>()

const tags = computed(() => toTags(props.modelValue))
const maxTags = computed(() => typeof props.options?.max === 'number' ? props.options.max : undefined)

// An array (a JSON column) by default; `storeAs: 'string'` stores a comma-separated text column.
function emitTags(value: unknown[]) {
  const list = value.map(String)
  emit('update:modelValue', props.options?.storeAs === 'string' ? list.join(',') : list)
}
</script>
