<template>
  <DefineTemplate>
    <!-- Loading state -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center p-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin h-8 w-8 text-primary-500 mb-4" />
      <span class="text-gray-600 dark:text-gray-400">Loading...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="p-6">
      <div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <UIcon name="i-heroicons-exclamation-circle" class="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 class="font-semibold text-red-900 dark:text-red-200">Error Loading Data</h3>
          <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Data display -->
    <div v-else-if="data" class="p-6">
      <dl class="grid grid-cols-1 gap-4">
        <div v-for="column in visibleColumns" :key="column.name" class="border-b border-gray-200 dark:border-gray-800 pb-4 last:border-b-0 last:pb-0">
          <dt class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            {{ formatFieldLabel(column.name) }}
          </dt>
          <dd class="text-base text-gray-900 dark:text-white font-medium">
            {{ formatDisplayValue(data[column.name], column) || '-' }}
          </dd>
        </div>
      </dl>

      <!-- M2M Relations (read-only) -->
      <div v-if="m2mFields.length > 0" class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Relationships</h3>
        <M2MRelationCard
          v-for="m2mField in m2mFields"
          :key="m2mField.name"
          :resource-name="resourceName"
          :resource-id="id"
          :relation="m2mField"
          :disabled="true"
        />
      </div>
    </div>
  </DefineTemplate>

  <UModal
    v-if="isDesktop"
    v-model:open="isOpen"
    :title="resource?.displayName || resourceName"
    :description="`Record #${id}`"
    :ui="{ content: 'w-full max-w-3xl', body: 'p-0' }"
  >
    <template #body>
      <ReuseTemplate />
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800">
        <UButton
          v-if="showButtonBehavior === 'disable' || canUpdate"
          variant="outline"
          icon="i-heroicons-pencil"
          :disabled="!canUpdate"
          @click="handleEdit"
        >
          Edit
        </UButton>
        <UButton
          v-if="showButtonBehavior === 'disable' || canDelete"
          color="error"
          variant="ghost"
          icon="i-heroicons-trash"
          :disabled="!canDelete"
          @click="handleDelete"
        >
          Delete
        </UButton>
      </div>
    </template>
  </UModal>

  <UDrawer
    v-else
    v-model:open="isOpen"
    :title="resource?.displayName || resourceName"
    :description="`Record #${id}`"
    direction="bottom"
    :ui="{ content: 'w-full', body: 'p-0' }"
  >
    <template #body>
      <ReuseTemplate />
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800">
        <UButton
          v-if="showButtonBehavior === 'disable' || canUpdate"
          variant="outline"
          icon="i-heroicons-pencil"
          :disabled="!canUpdate"
          @click="handleEdit"
        >
          Edit
        </UButton>
        <UButton
          v-if="showButtonBehavior === 'disable' || canDelete"
          color="error"
          variant="ghost"
          icon="i-heroicons-trash"
          :disabled="!canDelete"
          @click="handleDelete"
        >
          Delete
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import { formatFieldLabel, formatDisplayValue } from '../../utils/fieldTypeMapping'
import M2MRelationCard from '../M2MRelationCard.vue'
import { useM2MDetection } from '../../composables/useM2MDetection'

const [DefineTemplate, ReuseTemplate] = createReusableTemplate()

const props = defineProps<{
  resourceName: string
  id: string | number
  open?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  edit: [id: string | number]
  delete: [id: string | number]
}>()

const { resource } = useAdminResource(props.resourceName)
const { data: response, isLoading, error } = useAutoApiGet(props.resourceName, computed(() => props.id))
const { canUpdate, canDelete } = useAdminPermissions(props.resourceName)
const { permissions: permissionConfig } = useAdminConfig()
const showButtonBehavior = computed(() => permissionConfig.unauthorizedButtons || 'disable')

const isOpen = computed({
  get: () => props.open ?? false,
  set: (value) => emit('update:open', value),
})

const isDesktop = useMediaQuery('(min-width: 1024px)')

// Extract actual data from response
const data = computed(() => response.value?.data)

const visibleColumns = computed(() => {
  if (!resource.value || !data.value) return []

  return resource.value.columns.filter((col) => {
    // Hide sensitive fields
    if (resource.value!.hiddenFields.includes(col.name)) return false

    // Hide password fields
    if (col.name.toLowerCase().includes('password')) return false

    // Hide soft delete fields
    if (col.name === 'deletedAt') return false

    // Hide null/undefined values
    const value = data.value?.[col.name]
    if (value === null || value === undefined) return false

    return true
  })
})

// Auto-detect M2M fields
const { detectM2MFields, mergeM2MFields } = useM2MDetection()
const autoM2MFields = ref<any[]>([])

// Detect M2M fields when modal opens
watch(() => props.open, async (isOpen) => {
  if (isOpen && autoM2MFields.value.length === 0) {
    autoM2MFields.value = await detectM2MFields(props.resourceName)
  }
}, { immediate: true })

// Get M2M fields from resource form fields (manual config)
const manualM2MFields = computed(() => {
  if (!resource.value?.formFields?.edit) return []

  return resource.value.formFields.edit.filter(
    field => field.widget === 'MultiRelationSelect' && field.options?.junctionTable
  )
})

// Merge auto-detected with manual M2M fields
const m2mFields = computed(() => {
  return mergeM2MFields(autoM2MFields.value, manualM2MFields.value)
})

function handleEdit() {
  emit('edit', props.id)
  emit('update:open', false)
}

function handleDelete() {
  emit('delete', props.id)
}
</script>
