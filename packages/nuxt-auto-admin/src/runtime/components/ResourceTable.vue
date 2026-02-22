<template>
  <div class="space-y-4">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center p-12">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin h-8 w-8 text-primary-500 mb-4" />
      <span class="text-gray-600 dark:text-gray-400">Loading data...</span>
    </div>

    <!-- Permission denied state -->
    <PermissionDeniedPage
      v-else-if="error && isPermissionError"
      :message="permissionErrorMessage"
    />

    <!-- Error state -->
    <div v-else-if="error" class="p-6">
      <div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <UIcon name="i-heroicons-exclamation-circle" class="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 class="font-semibold text-red-900 dark:text-red-200">Error Loading Data</h3>
          <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ error }}</p>
          <UButton variant="soft" color="error" size="sm" class="mt-3" @click="refetch">
            Try Again
          </UButton>
        </div>
      </div>
    </div>

    <!-- Table -->
    <UTable v-else :data="data || []" :columns="columns" :loading="isLoading">
      <!-- Empty state -->
      <template #empty>
        <div class="text-center py-12 px-4">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <UIcon name="i-heroicons-inbox" class="h-8 w-8 text-gray-400" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No records found</h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Get started by creating your first {{ resourceNameValue }}
          </p>
          <UButton v-if="canCreate" size="lg" icon="i-heroicons-plus" @click="handleCreate">
            Create {{ resourceNameValue }}
          </UButton>
        </div>
      </template>
    </UTable>

    <!-- Pagination -->
    <div v-if="data && data.length > 0 && meta" class="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Showing <span class="font-medium text-gray-900 dark:text-white">{{ ((meta.page || 1) - 1) * (meta.limit || 20) + 1 }}</span> to
        <span class="font-medium text-gray-900 dark:text-white">{{ Math.min((meta.page || 1) * (meta.limit || 20), meta.total || 0) }}</span> of
        <span class="font-medium text-gray-900 dark:text-white">{{ meta.total || 0 }}</span> results
      </div>

      <UPagination
        v-if="meta.total && meta.limit"
        :model-value="meta.page || 1"
        :total="meta.total"
        :page-size="meta.limit"
        @update:model-value="handlePageChange"
      />
    </div>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteModal.open">
      <template #body>
        <div class="p-4">
          <h3 class="text-lg font-semibold mb-2">Confirm Delete</h3>
          <p class="text-gray-600">
            Are you sure you want to delete this {{ resourceNameValue }}? This action cannot be undone.
          </p>
        </div>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="close">Cancel</UButton>
          <UButton color="error" :loading="isDeleting" @click="confirmDelete">Delete</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { h, computed, reactive, resolveComponent, unref } from 'vue'
import type { MaybeRef } from 'vue'
import { useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'
import { formatDisplayValue, formatFieldLabel } from '../utils/fieldTypeMapping'
import PermissionDeniedPage from './PermissionDeniedPage.vue'

// Composables are auto-imported from nuxt-auto-api and nuxt-auto-admin

const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const props = defineProps<{
  resourceName: MaybeRef<string>
}>()

const emit = defineEmits<{
  create: []
  view: [id: string | number]
  edit: [id: string | number]
}>()

const router = useRouter()
const config = useRuntimeConfig()
const adminPrefix = config.public.autoAdmin?.prefix || '/admin'

// Unwrap the resource name in case it's a ref
const resourceNameValue = computed(() => unref(props.resourceName))

const { resource } = useAdminResource(resourceNameValue.value)
const { data: permissions } = usePermissions(resourceNameValue.value)

const canCreate = computed(() => permissions.value?.canCreate ?? true)
const canUpdate = computed(() => permissions.value?.canUpdate ?? true)
const canDelete = computed(() => permissions.value?.canDelete ?? true)

// List data
const queryParams = reactive({
  page: 1,
  limit: 20,
})

const { data: response, isLoading, error, refetch } = useAutoApiList(
  resourceNameValue.value,
  queryParams
)

const data = computed(() => response.value?.data || [])
const meta = computed(() => response.value?.meta)

// Check if error is a permission error (401 or 403)
const isPermissionError = computed(() => {
  if (!error.value) return false
  const errorObj = error.value as any
  const statusCode = errorObj?.statusCode || errorObj?.response?.status
  return statusCode === 401 || statusCode === 403
})

const permissionErrorMessage = computed(() => {
  if (!error.value) return ''
  const errorObj = error.value as any
  const statusCode = errorObj?.statusCode || errorObj?.response?.status
  if (statusCode === 401) {
    return errorObj?.message || 'Authentication required. Please log in to access this resource.'
  }
  return errorObj?.message || `You don't have permission to access ${resourceNameValue.value}`
})

// Actions
const { handleDelete: deleteResource, isDeleting } = useAdminActions(resourceNameValue.value)

const deleteModal = reactive({
  open: false,
  itemId: null as string | number | null,
})

// Build columns dynamically from resource schema
const columns = computed<TableColumn<any>[]>(() => {
  if (!resource.value) return []

  const cols: TableColumn<any>[] = []

  // Add data columns based on listFields
  resource.value.listFields.forEach((fieldName) => {
    const column = resource.value!.columns.find((col) => col.name === fieldName)

    cols.push({
      accessorKey: fieldName,
      header: formatFieldLabel(fieldName),
      cell: ({ row }: any) => {
        const value = row.getValue(fieldName)

        // Handle boolean values with badges
        if (column && typeof value === 'boolean') {
          return h(
            'span',
            {
              class: value
                ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
            },
            value ? 'Yes' : 'No'
          )
        }

        // Handle status fields with badges
        if (column && (fieldName === 'status' || fieldName === 'state') && typeof value === 'string') {
          const statusColors: Record<string, string> = {
            active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
          }
          const colorClass = statusColors[value.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'

          return h(
            'span',
            {
              class: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`
            },
            value
          )
        }

        if (column) {
          return formatDisplayValue(value, column)
        }
        return value || '-'
      },
    })
  })

  // Add actions column
  cols.push({
    id: 'actions',
    enableHiding: false,
    meta: {
      class: {
        td: 'text-right',
      },
    },
    cell: ({ row }: any) => {
      // Create items array as a computed to ensure reactivity
      const items = computed(() => [
        [
          {
            type: 'label' as const,
            label: 'Actions',
          },
        ],
        [
          {
            label: 'View',
            icon: 'i-heroicons-eye',
            onSelect: () => handleView(row.original),
          },
          {
            label: 'Edit',
            icon: 'i-heroicons-pencil',
            disabled: !canUpdate.value,
            onSelect: () => handleEdit(row.original),
          },
          {
            label: 'Delete',
            icon: 'i-heroicons-trash',
            disabled: !canDelete.value,
            onSelect: () => openDeleteModal(row.original),
          },
        ],
      ])

      return h(
        UDropdownMenu,
        {
          items: items.value,
        },
        () =>
          h(UButton, {
            icon: 'i-heroicons-ellipsis-horizontal',
            variant: 'ghost',
            color: 'neutral',
          })
      )
    },
  })

  return cols
})

function handlePageChange(newPage: number) {
  queryParams.page = newPage
}

function handleCreate() {
  emit('create')
}

function handleView(item: any) {
  const idField = resource.value?.primaryKey || 'id'
  emit('view', item[idField])
}

function handleEdit(item: any) {
  const idField = resource.value?.primaryKey || 'id'
  emit('edit', item[idField])
}

function openDeleteModal(item: any) {
  const idField = resource.value?.primaryKey || 'id'
  deleteModal.itemId = item[idField]
  deleteModal.open = true
}

async function confirmDelete() {
  if (!deleteModal.itemId) return

  try {
    await deleteResource(deleteModal.itemId)
    deleteModal.open = false
    deleteModal.itemId = null
    refetch()
  } catch (error) {
    // Error is handled by useAdminActions
  }
}
</script>
