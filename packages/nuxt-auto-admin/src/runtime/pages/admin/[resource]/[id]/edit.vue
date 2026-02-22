<template>
  <div class="space-y-4">
    <!-- Page Header -->
    <div class="flex items-start gap-3">
      <UButton
        icon="i-heroicons-arrow-left"
        variant="ghost"
        @click="goToDetail(id)"
      />
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          Edit {{ resource?.displayName || resourceName }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Record #{{ id }}
        </p>
      </div>
    </div>

    <!-- Permission Warning (if button behavior is disable) -->
    <UCard v-if="!isLoadingPermissions && !canUpdate && showButtonBehavior === 'disable'" class="border-orange-200/60 dark:border-orange-800/60">
      <div class="p-4">
        <div class="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <UIcon name="i-heroicons-exclamation-triangle" class="h-6 w-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-orange-900 dark:text-orange-200">Limited Access</h3>
            <p class="text-sm text-orange-700 dark:text-orange-300 mt-1">
              You can view this record but don't have permission to update it.
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Permission Denied (if button behavior is hide) -->
    <UCard v-else-if="!isLoadingPermissions && !canUpdate && showButtonBehavior === 'hide'" class="border-gray-200/60 dark:border-gray-800/60">
      <div class="p-6">
        <div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <UIcon name="i-heroicons-exclamation-circle" class="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-red-900 dark:text-red-200">Permission Denied</h3>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">
              {{ getPermissionDeniedMessage('update') }}
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Form Card -->
    <UCard v-else class="border-gray-200/60 dark:border-gray-800/60">
      <ResourceForm
        :resource-name="resourceName"
        :id="id"
        mode="edit"
        :disabled="!canUpdate"
        show-cancel
        @success="handleSuccess"
        @cancel="goToDetail(id)"
      />
    </UCard>

    <!-- M2M Relations Cards -->
    <template v-if="m2mFields.length > 0 && (canUpdate || showButtonBehavior === 'disable')">
      <M2MRelationCard
        v-for="m2mField in m2mFields"
        :key="m2mField.name"
        :resource-name="resourceName"
        :resource-id="id"
        :relation="m2mField"
        :disabled="!canUpdate"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import M2MRelationCard from '../../../../components/M2MRelationCard.vue'
import { useM2MDetection } from '../../../../composables/useM2MDetection'

definePageMeta({
  layout: 'admin',
})

const route = useRoute()
const resourceName = computed(() => route.params.resource as string)
const id = computed(() => route.params.id as string)

const { resource } = useAdminResource(resourceName.value)
const { goToDetail } = useAdminActions(resourceName.value)
const {
  canUpdate,
  isLoading: isLoadingPermissions,
  getPermissionDeniedMessage
} = useAdminPermissions(resourceName.value)

const { permissions: permissionConfig } = useAdminConfig()
const showButtonBehavior = computed(() => permissionConfig.unauthorizedButtons || 'disable')

// Auto-detect M2M fields
const { detectM2MFields, mergeM2MFields } = useM2MDetection()
const autoM2MFields = ref<any[]>([])

onMounted(async () => {
  autoM2MFields.value = await detectM2MFields(resourceName.value)
})

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

function handleSuccess() {
  goToDetail(id.value)
}
</script>
