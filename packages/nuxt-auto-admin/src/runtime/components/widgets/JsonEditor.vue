<template>
  <div class="w-full">
    <UTextarea
      :model-value="text"
      :placeholder="placeholder || '{ }'"
      :disabled="readonly"
      :required="required"
      :rows="(options?.rows as number | undefined) || 8"
      :color="error ? 'error' : undefined"
      :highlight="!!error"
      autoresize
      class="w-full"
      :ui="{ base: 'font-mono text-sm' }"
      @update:model-value="onInput"
    />
    <p
      v-if="error"
      class="mt-1 text-sm text-error"
    >
      Not valid JSON: {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { WidgetOptions } from '../../types'
import { jsonText, parseJsonText } from '../../utils/widgetValues'

const props = defineProps<{
  modelValue?: unknown
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

// The text is the source of truth while it is being edited; the value (parsed JSON) is emitted only when the text
// parses, so a half-typed object never reaches the form.
const text = ref(jsonText(props.modelValue))
const error = ref<string | null>(null)
let lastEmitted: unknown

watch(() => props.modelValue, (value) => {
  if (value === lastEmitted) return
  text.value = jsonText(value)
  error.value = null
})

function onInput(value: string | number) {
  text.value = String(value ?? '')
  const result = parseJsonText(text.value)
  if ('error' in result) {
    error.value = result.error
    return
  }
  error.value = null
  lastEmitted = result.value
  emit('update:modelValue', result.value)
}
</script>
