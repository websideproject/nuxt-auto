<template>
  <UCheckbox
    :model-value="modelValue"
    :disabled="readonly"
    :required="required"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: boolean
  readonly?: boolean
  required?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
