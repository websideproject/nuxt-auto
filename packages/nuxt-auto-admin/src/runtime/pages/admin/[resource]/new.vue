<template>
  <div class="space-y-4">
    <!-- Page Header -->
    <div class="flex items-start gap-3">
      <UButton
        icon="i-heroicons-arrow-left"
        variant="ghost"
        @click="goToList"
      />
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          Create {{ resource?.displayName || resourceName }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Add a new {{ resource?.displayName?.toLowerCase() || resourceName }}
        </p>
      </div>
    </div>

    <!-- Permission Warning (if button behavior is disable) -->
    <UCard v-if="!isLoadingPermissions && !canCreate && showButtonBehavior === 'disable'" class="border-orange-200/60 dark:border-orange-800/60">
      <div class="p-4">
        <div class="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <UIcon name="i-heroicons-exclamation-triangle" class="h-6 w-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-orange-900 dark:text-orange-200">Limited Access</h3>
            <p class="text-sm text-orange-700 dark:text-orange-300 mt-1">
              You don't have permission to create new records for this resource.
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Permission Denied (if button behavior is hide) -->
    <UCard v-else-if="!isLoadingPermissions && !canCreate && showButtonBehavior === 'hide'" class="border-gray-200/60 dark:border-gray-800/60">
      <div class="p-6">
        <div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <UIcon name="i-heroicons-exclamation-circle" class="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-red-900 dark:text-red-200">Permission Denied</h3>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">
              {{ getPermissionDeniedMessage('create') }}
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Form Card -->
    <UCard v-else class="border-gray-200/60 dark:border-gray-800/60">
      <ResourceForm
        :resource-name="resourceName"
        mode="create"
        :disabled="!canCreate"
        show-cancel
        @success="handleSuccess"
        @cancel="goToList"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

definePageMeta({
  layout: 'admin',
})

const route = useRoute()
const resourceName = computed(() => route.params.resource as string)

const { resource } = useAdminResource(resourceName.value)
const { goToList, goToDetail } = useAdminActions(resourceName.value)
const {
  canCreate,
  isLoading: isLoadingPermissions,
  getPermissionDeniedMessage
} = useAdminPermissions(resourceName.value)

const { permissions: permissionConfig } = useAdminConfig()
const showButtonBehavior = computed(() => permissionConfig.unauthorizedButtons || 'disable')

function handleSuccess(data: any) {
  const idField = resource.value?.primaryKey || 'id'
  goToDetail(data[idField])
}
</script>
