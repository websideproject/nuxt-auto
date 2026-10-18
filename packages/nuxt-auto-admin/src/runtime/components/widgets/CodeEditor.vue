<template>
  <div
    class="w-full rounded-md border border-default overflow-hidden"
    :class="dark ? 'bg-neutral-950 text-neutral-100' : 'bg-default'"
  >
    <div
      v-if="language"
      class="flex justify-end px-2 py-1 border-b border-default"
    >
      <UBadge
        :label="language"
        color="neutral"
        variant="subtle"
        size="sm"
      />
    </div>
    <textarea
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :disabled="readonly"
      :required="required"
      :rows="(options?.rows as number | undefined) || 10"
      spellcheck="false"
      class="block w-full resize-y bg-transparent p-3 font-mono text-sm outline-none disabled:opacity-75"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @keydown.tab.prevent="indent"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetOptions } from '../../types'

const props = defineProps<{
  modelValue?: string | null
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// A plain monospace editor: `language` is shown as a label (no highlighting), `theme: 'dark'` switches the colours.
const language = computed(() => props.options?.language)
const dark = computed(() => props.options?.theme === 'dark')

// Tab inserts two spaces instead of leaving the field
function indent(event: KeyboardEvent) {
  const el = event.target as HTMLTextAreaElement
  const { selectionStart: start, selectionEnd: end, value } = el
  const next = `${value.slice(0, start)}  ${value.slice(end)}`
  emit('update:modelValue', next)
  requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2))
}
</script>
