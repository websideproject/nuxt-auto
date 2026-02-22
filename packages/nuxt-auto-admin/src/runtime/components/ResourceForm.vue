<template>
  <div>
    <div v-if="isLoadingResource || (mode === 'edit' && isLoadingData)" class="flex items-center justify-center p-8">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6" />
      <span class="ml-2">Loading...</span>
    </div>

    <div v-else-if="loadError" class="p-4 bg-red-50 text-red-600 rounded">
      {{ loadError }}
    </div>

    <AutoForm
      v-else
      :fields="fields"
      :initial-data="initialData"
      :mode="mode"
      :show-cancel="showCancel"
      :show-reset="showReset"
      :submit-label="submitLabel"
      :disabled="disabled"
      @submit="handleSubmit"
      @cancel="$emit('cancel')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AutoForm from './AutoForm.vue'

// Composables are auto-imported

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
  success: [data: any]
  cancel: []
}>()

const { resource, isLoading: isLoadingResource } = useAdminResource(props.resourceName)
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
const { mutate: createResource, isPending: isCreating } = useAutoApiCreate(props.resourceName)
const { mutate: updateResource, isPending: isUpdating } = useAutoApiUpdate(props.resourceName)

const initialData = computed(() => {
  if (props.mode === 'edit' && existingData.value) {
    // API response is wrapped in { data: {...} }
    return existingData.value.data || existingData.value
  }
  return {}
})

function handleSubmit(data: Record<string, any>) {
  if (props.mode === 'edit' && props.id) {
    updateResource(
      { id: props.id, data },
      {
        onSuccess: (result) => {
          emit('success', result)
        },
        onError: (error: any) => {
          console.error('Failed to update:', error)
        },
      }
    )
  } else {
    createResource(data, {
      onSuccess: (result) => {
        emit('success', result)
      },
      onError: (error: any) => {
        console.error('Failed to create:', error)
      },
    })
  }
}
</script>
