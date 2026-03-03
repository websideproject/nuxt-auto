<template>
  <div class="space-y-2 w-full">
    <UInput
      type="password"
      :model-value="modelValue"
      :placeholder="placeholder || 'Enter password'"
      :disabled="readonly"
      :required="required"
      class="w-full"
      @update:model-value="$emit('update:modelValue', $event)"
    />

    <UInput
      v-if="showConfirm"
      type="password"
      :model-value="confirmValue"
      placeholder="Confirm password"
      :disabled="readonly"
      :required="required"
      class="w-full"
      @update:model-value="confirmValue = $event"
    />

    <p v-if="showConfirm && confirmValue && modelValue !== confirmValue" class="text-sm text-red-500">
      Passwords do not match
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  readonly?: boolean
  required?: boolean
  showConfirm?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const confirmValue = ref('')

// Reset confirm when model value changes externally
watch(
  () => props.modelValue,
  () => {
    confirmValue.value = ''
  }
)
</script>
