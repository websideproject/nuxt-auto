<template>
  <UForm :state="formData" @submit="handleSubmit">
    <div class="w-full p-6">
      <!-- Form Fields -->
      <div class="space-y-5 max-w-3xl">
        <AutoField
          v-for="field in visibleFields"
          :key="field.name"
          :field="field"
          :model-value="formData[field.name]"
          :error="errors[field.name]"
          :disabled="disabled || mode === 'view'"
          @update:model-value="updateField(field.name, $event)"
        />
      </div>

      <!-- Form Actions -->
      <div class="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800">
        <UButton
          type="submit"
          :loading="isSubmitting"
          :disabled="disabled || mode === 'view'"
        >
          {{ submitLabel }}
        </UButton>

        <UButton
          v-if="showCancel"
          variant="ghost"
          @click="$emit('cancel')"
        >
          Cancel
        </UButton>

        <UButton
          v-if="showReset && mode !== 'view'"
          variant="ghost"
          :disabled="disabled"
          @click="resetForm"
        >
          Reset
        </UButton>
      </div>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FieldConfig } from '../types'
import AutoField from './AutoField.vue'

const props = defineProps<{
  fields: FieldConfig[]
  initialData?: Record<string, any>
  mode?: 'create' | 'edit' | 'view'
  showCancel?: boolean
  showReset?: boolean
  submitLabel?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [data: Record<string, any>]
  cancel: []
}>()

const formData = ref<Record<string, any>>({})
const errors = ref<Record<string, string>>({})
const isSubmitting = ref(false)

// Initialize form data
watch(
  [() => props.fields, () => props.initialData],
  () => {
    const data: Record<string, any> = {}

    props.fields.forEach((field) => {
      if (props.initialData && field.name in props.initialData) {
        data[field.name] = props.initialData[field.name]
      } else {
        // Set default values
        if (field.widget === 'CheckboxInput') {
          data[field.name] = false
        } else if (field.widget === 'NumberInput') {
          data[field.name] = field.options?.min || 0
        } else {
          data[field.name] = ''
        }
      }
    })

    formData.value = data
  },
  { immediate: true }
)

// Filter fields based on conditions
const visibleFields = computed(() => {
  return props.fields.filter((field) => {
    if (field.condition) {
      return field.condition(formData.value)
    }
    return true
  })
})

const submitLabel = computed(() => {
  if (props.submitLabel) return props.submitLabel
  if (props.mode === 'create') return 'Create'
  if (props.mode === 'edit') return 'Save'
  return 'Submit'
})

function updateField(name: string, value: any) {
  formData.value[name] = value
  // Clear error for this field
  if (errors.value[name]) {
    delete errors.value[name]
  }
}

function resetForm() {
  watch(
    [() => props.fields, () => props.initialData],
    () => {
      const data: Record<string, any> = {}

      props.fields.forEach((field) => {
        if (props.initialData && field.name in props.initialData) {
          data[field.name] = props.initialData[field.name]
        } else {
          if (field.widget === 'CheckboxInput') {
            data[field.name] = false
          } else if (field.widget === 'NumberInput') {
            data[field.name] = field.options?.min || 0
          } else {
            data[field.name] = ''
          }
        }
      })

      formData.value = data
    },
    { immediate: true }
  )

  errors.value = {}
}

async function handleSubmit() {
  // Validate required fields
  errors.value = {}
  let hasErrors = false

  visibleFields.value.forEach((field) => {
    if (field.required && !formData.value[field.name]) {
      errors.value[field.name] = 'This field is required'
      hasErrors = true
    }
  })

  if (hasErrors) {
    return
  }

  isSubmitting.value = true

  try {
    // Filter out readonly fields for edit mode
    const dataToSubmit = { ...formData.value }

    if (props.mode === 'edit') {
      visibleFields.value.forEach((field) => {
        if (field.readonly) {
          delete dataToSubmit[field.name]
        }
      })
    }

    emit('submit', dataToSubmit)
  } finally {
    isSubmitting.value = false
  }
}

// Expose methods for parent components
defineExpose({
  formData,
  errors,
  resetForm,
})
</script>
