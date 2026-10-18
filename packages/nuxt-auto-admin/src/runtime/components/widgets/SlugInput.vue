<template>
  <UInput
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="readonly"
    :required="required"
    class="w-full"
    @update:model-value="onInput"
  >
    <template
      v-if="source && !readonly"
      #trailing
    >
      <UButton
        color="neutral"
        variant="link"
        size="sm"
        icon="i-heroicons-arrow-path"
        :aria-label="`Generate from ${source}`"
        class="px-0"
        @click="generate"
      />
    </template>
  </UInput>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WidgetOptions } from '../../types'
import { slugify } from '../../utils/widgetValues'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
  formData?: Record<string, unknown>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// `generateFrom`: the field the slug follows while it is empty or still the generated one — typing your own slug
// stops that; the button regenerates it.
const source = computed(() => props.options?.generateFrom)
const following = ref(!props.modelValue)

watch(() => source.value ? props.formData?.[source.value] : undefined, (value) => {
  if (following.value && typeof value === 'string') emit('update:modelValue', slugify(value))
})

function onInput(value: string | number) {
  following.value = !value
  emit('update:modelValue', slugify(String(value ?? '')))
}

function generate() {
  following.value = true
  emit('update:modelValue', slugify(String(props.formData?.[source.value!] ?? '')))
}
</script>
