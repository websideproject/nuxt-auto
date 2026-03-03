<template>
  <div class="space-y-4">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          {{ resource?.displayName || resourceName }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage all {{ resource?.displayName?.toLowerCase() || resourceName }}
        </p>
      </div>

      <UButton
        v-if="showButtonBehavior === 'disable' || canCreate"
        icon="i-heroicons-plus"
        :disabled="!canCreate"
        @click="openCreateModal"
      >
        Create New
      </UButton>
    </div>

    <!-- Table Card -->
    <UCard class="border-gray-200/60 dark:border-gray-800/60">
      <ResourceTable
        v-if="resourceName"
        :resource-name="resourceName"
        @create="openCreateModal"
        @view="openViewModal"
        @edit="openEditModal"
      />
    </UCard>

    <!-- Modals -->
    <ResourceCreateModal
      v-model:open="createModalOpen"
      :resource-name="resourceName"
      @success="handleCreateSuccess"
    />

    <ResourceViewModal
      v-if="viewModalId"
      v-model:open="viewModalOpen"
      :resource-name="resourceName"
      :id="viewModalId"
      @edit="openEditModalFromView"
      @delete="openDeleteModalFromView"
    />

    <ResourceEditModal
      v-if="editModalId"
      v-model:open="editModalOpen"
      :resource-name="resourceName"
      :id="editModalId"
      @success="handleEditSuccess"
    />

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
            Delete
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ResourceCreateModal from '../../../components/modals/ResourceCreateModal.vue'
import ResourceViewModal from '../../../components/modals/ResourceViewModal.vue'
import ResourceEditModal from '../../../components/modals/ResourceEditModal.vue'

// Composables are auto-imported

definePageMeta({
  layout: 'admin',
})

const route = useRoute()
const toast = useToast()

// Create a computed ref for the resource name to handle route changes
const resourceName = computed(() => route.params.resource as string)

const { resource } = useAdminResource(resourceName.value)
const { handleDelete, isDeleting, goToEdit, goToDetail } = useAdminActions(resourceName.value)
const { canCreate } = useAdminPermissions(resourceName.value)

const { permissions: permissionConfig, ui: uiConfig } = useAdminConfig()
const showButtonBehavior = computed(() => permissionConfig.unauthorizedButtons || 'disable')
const editMode = computed(() => uiConfig.editMode)
const viewMode = computed(() => uiConfig.viewMode)

// Modal states
const createModalOpen = ref(false)
const viewModalOpen = ref(false)
const viewModalId = ref<string | number | null>(null)
const editModalOpen = ref(false)
const editModalId = ref<string | number | null>(null)
const deleteModalOpen = ref(false)
const deleteModalId = ref<string | number | null>(null)

function openCreateModal() {
  createModalOpen.value = true
}

function openViewModal(id: string | number) {
  // Check config to decide between modal or page
  if (viewMode.value === 'page') {
    goToDetail(id)
  } else {
    viewModalId.value = id
    viewModalOpen.value = true
  }
}

function openEditModal(id: string | number) {
  // Check config to decide between modal or page
  if (editMode.value === 'page') {
    goToEdit(id)
  } else {
    editModalId.value = id
    editModalOpen.value = true
  }
}

function openEditModalFromView(id: string | number) {
  viewModalOpen.value = false
  editModalId.value = id
  editModalOpen.value = true
}

function openDeleteModalFromView(id: string | number) {
  viewModalOpen.value = false
  deleteModalId.value = id
  deleteModalOpen.value = true
}

function handleCreateSuccess(data: any) {
  toast.add({
    title: 'Success',
    description: `${resource.value?.displayName || resourceName.value} created successfully`,
    icon: 'i-heroicons-check-circle',
    color: 'success'
  })
  // Table will auto-refresh via query invalidation
}

function handleEditSuccess(data: any) {
  toast.add({
    title: 'Success',
    description: `${resource.value?.displayName || resourceName.value} updated successfully`,
    icon: 'i-heroicons-check-circle',
    color: 'success'
  })
  // Table will auto-refresh via query invalidation
}

async function confirmDelete() {
  if (!deleteModalId.value) return

  try {
    await handleDelete(deleteModalId.value)
    deleteModalOpen.value = false
    deleteModalId.value = null

    toast.add({
      title: 'Success',
      description: `${resource.value?.displayName || resourceName.value} deleted successfully`,
      icon: 'i-heroicons-check-circle',
      color: 'success'
    })
  } catch (error) {
    // Error is handled by useAdminActions
  }
}
</script>
