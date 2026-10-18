<template>
  <UInput
    :model-value="modelValue ?? ''"
    :placeholder="placeholder || '#000000'"
    :disabled="readonly"
    :required="required"
    class="w-full"
    @update:model-value="$emit('update:modelValue', String($event ?? ''))"
  >
    <template #leading>
      <UPopover :disabled="readonly">
        <button
          type="button"
          class="size-5 rounded border border-default"
          :style="{ backgroundColor: modelValue || 'transparent' }"
          aria-label="Pick a color"
        />
        <template #content>
          <UColorPicker
            :model-value="modelValue || undefined"
            :format="(options?.format as 'hex' | 'rgb' | 'hsl' | undefined) || 'hex'"
            class="p-2"
            @update:model-value="$emit('update:modelValue', $event ?? '')"
          />
        </template>
      </UPopover>
    </template>
  </UInput>
</template>

<script setup lang="ts">
import type { WidgetOptions } from '../../types'

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
