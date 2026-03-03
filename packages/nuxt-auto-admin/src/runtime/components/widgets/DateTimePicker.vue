<template>
  <UInput
    :type="showTime ? 'datetime-local' : 'date'"
    :model-value="formattedValue"
    :disabled="readonly"
    :required="required"
    class="w-full"
    @update:model-value="handleInput"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetOptions } from '../../types'

const props = defineProps<{
  modelValue?: string | Date
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showTime = computed(() => props.options?.showTime ?? false)

const formattedValue = computed(() => {
  if (!props.modelValue) return ''

  try {
    const date = new Date(props.modelValue)
    if (showTime.value) {
      // Format for datetime-local input: YYYY-MM-DDThh:mm
      return date.toISOString().slice(0, 16)
    } else {
      // Format for date input: YYYY-MM-DD
      return date.toISOString().slice(0, 10)
    }
  } catch {
    return ''
  }
})

function handleInput(value: string) {
  if (!value) {
    emit('update:modelValue', '')
    return
  }

  // Convert to ISO string
  const date = new Date(value)
  emit('update:modelValue', date.toISOString())
}
</script>
