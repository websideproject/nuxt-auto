<template>
  <div class="space-y-4">
    <!-- Page Header -->
    <div class="flex items-start justify-between">
      <div class="flex items-start gap-3">
        <UButton
          icon="i-heroicons-arrow-left"
          variant="ghost"
          @click="goToList"
        />
        <div>
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
            {{ resource?.displayName || resourceName }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Record #{{ id }}
          </p>
        </div>
      </div>

      <div class="flex gap-2">
        <UButton
          v-if="showButtonBehavior === 'disable' || canUpdate"
          icon="i-heroicons-pencil"
          variant="outline"
          :disabled="!canUpdate"
          @click="goToEdit(id)"
        >
          Edit
        </UButton>
        <UButton
          v-if="showButtonBehavior === 'disable' || canDelete"
          icon="i-heroicons-trash"
          color="error"
          variant="ghost"
          :disabled="!canDelete"
          @click="openDeleteModal"
        >
          Delete
        </UButton>
      </div>
    </div>

    <!-- Permission Denied -->
    <UCard v-if="!isLoadingPermissions && !canRead" class="border-gray-200/60 dark:border-gray-800/60">
      <div class="p-6">
        <div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <UIcon name="i-heroicons-exclamation-circle" class="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-red-900 dark:text-red-200">Permission Denied</h3>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">
              {{ getPermissionDeniedMessage('read') }}
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Content -->
    <UCard v-else class="border-gray-200/60 dark:border-gray-800/60">
      <!-- Loading state -->
      <div v-if="isLoading || isLoadingPermissions" class="flex flex-col items-center justify-center p-12">
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
      <div v-else-if="data" class="divide-y divide-gray-200/60 dark:divide-gray-800/60">
        <div v-for="column in visibleColumns" :key="column.name" class="py-3 px-6">
          <dt class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {{ formatFieldLabel(column.name) }}
          </dt>
          <dd class="text-sm text-gray-900 dark:text-white">
            {{ formatDisplayValue(data[column.name], column) }}
          </dd>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="p-12 text-center">
        <UIcon name="i-heroicons-inbox" class="h-10 w-10 text-gray-400 mx-auto mb-2" />
        <p class="text-sm text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    </UCard>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteModalOpen">
      <template #body>
        <div class="p-6">
          <div class="flex items-start gap-4">
            <div class="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <UIcon name="i-heroicons-exclamation-triangle" class="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Confirm Delete</h3>
              <p class="text-gray-600 dark:text-gray-400">
                Are you sure you want to delete this {{ resourceName }}? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50">
          <UButton variant="ghost" @click="close">Cancel</UButton>
          <UButton color="error" :loading="isDeleting" @click="confirmDelete">
            <template v-if="!isDeleting">Delete</template>
            <template v-else>Deleting...</template>
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatFieldLabel, formatDisplayValue } from '../../../utils/fieldTypeMapping'

// Composables are auto-imported

definePageMeta({
  layout: 'admin',
})

const route = useRoute()
const resourceName = computed(() => route.params.resource as string)
const id = computed(() => route.params.id as string)

const { resource } = useAdminResource(resourceName.value)
const { data: response, isLoading, error } = useAutoApiGet(resourceName.value, id)
const {
  canRead,
  canUpdate,
  canDelete,
  isLoading: isLoadingPermissions,
  getPermissionDeniedMessage
} = useAdminPermissions(resourceName.value)
const { goToList, goToEdit, handleDelete, isDeleting } = useAdminActions(resourceName.value)

const { permissions: permissionConfig } = useAdminConfig()
const showButtonBehavior = computed(() => permissionConfig.unauthorizedButtons || 'disable')

// Extract actual data from response
const data = computed(() => response.value?.data)

const deleteModalOpen = ref(false)

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

function openDeleteModal() {
  deleteModalOpen.value = true
}

async function confirmDelete() {
  try {
    await handleDelete(id.value, { redirect: true })
    deleteModalOpen.value = false
  } catch (error) {
    // Error is handled by useAdminActions
  }
}
</script>
