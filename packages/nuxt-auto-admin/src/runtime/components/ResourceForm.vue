<template>
  <div>
    <div
      v-if="isLoadingResource || (mode === 'edit' && isLoadingData)"
      class="flex items-center justify-center p-8"
    >
      <UIcon
        name="i-heroicons-arrow-path"
        class="animate-spin h-6 w-6"
      />
      <span class="ml-2">Loading...</span>
    </div>

    <div
      v-else-if="loadError"
      class="p-4 bg-red-50 text-red-600 rounded"
    >
      {{ loadError }}
    </div>

    <template v-else>
      <UAlert
        v-if="saveError"
        color="error"
        variant="subtle"
        icon="i-heroicons-exclamation-triangle"
        :title="saveError.title"
        :description="saveError.details.join('\n') || undefined"
        class="mx-6 mt-6 whitespace-pre-line"
      />
      <AutoForm
        ref="autoForm"
        :fields="fields"
        :initial-data="initialData"
        :mode="mode"
        :show-cancel="showCancel"
        :show-reset="showReset"
        :submit-label="submitLabel"
        :disabled="disabled"
        :resource-name="resourceName"
        :record-id="mode === 'edit' ? id : undefined"
        @submit="handleSubmit"
        @cancel="$emit('cancel')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import AutoForm from './AutoForm.vue'
import { apiErrorMessage, apiFieldErrors } from '../utils/apiErrors'
import { useAdminResource } from '../composables/useAdminResource'
import { useResourceForm } from '../composables/useResourceForm'
import { useAutoApiGet, useAutoApiCreate, useAutoApiUpdate } from '@websideproject/nuxt-auto-api/composables'

const props = defineProps<{
  resourceName: string
  id?: string | number
  mode?: 'create' | 'edit'
  showCancel?: boolean
  showReset?: boolean
  submitLabel?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  success: [data: unknown]
  cancel: []
}>()

const { isLoading: isLoadingResource } = useAdminResource(props.resourceName)
const { fields } = useResourceForm(props.resourceName, props.mode || 'create')

// Load existing data for edit mode
const idRef = computed(() => props.id!)

const {
  data: existingData,
  isLoading: isLoadingData,
  error: loadError,
} = useAutoApiGet(props.resourceName, idRef, undefined, {
  enabled: computed(() => props.mode === 'edit' && !!props.id),
})

// Mutations
const { mutate: createResource } = useAutoApiCreate(props.resourceName)
const { mutate: updateResource } = useAutoApiUpdate(props.resourceName)

const initialData = computed(() => {
  if (props.mode === 'edit' && existingData.value) {
    // API response is wrapped in { data: {...} }
    return existingData.value.data || existingData.value
  }
  return {}
})

const autoForm = useTemplateRef<InstanceType<typeof AutoForm>>('autoForm')
const saveError = ref<{ title: string, details: string[] } | null>(null)

// A refused save: the API's validation issues go under their fields; the message, and issues on fields this form
// does not show, above the form.
function showSaveError(error: unknown) {
  const { fields: fieldErrors, other } = apiFieldErrors(error, fields.value.map(f => f.name))
  if (autoForm.value) autoForm.value.errors = fieldErrors
  saveError.value = { title: apiErrorMessage(error), details: other }
}

function handleSubmit(data: Record<string, unknown>) {
  saveError.value = null
  const callbacks = {
    // The API answers `{ data: row }`; `success` carries the row (the create page opens it by its id)
    onSuccess: (result: unknown) => {
      emit('success', (result as { data?: unknown } | undefined)?.data ?? result)
    },
    onError: showSaveError,
  }
  if (props.mode === 'edit' && props.id) updateResource({ id: props.id, data }, callbacks)
  else createResource(data, callbacks)
}
</script>
