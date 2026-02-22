<template>
  <UInput
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="readonly"
    :required="required"
    class="w-full"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: string
  placeholder?: string
  readonly?: boolean
  required?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
