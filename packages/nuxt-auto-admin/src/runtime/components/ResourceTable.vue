<template>
  <div class="space-y-4">
    <!-- Toolbar: stays mounted while the list reloads, so typing a search never loses focus -->
    <div
      v-if="showToolbar"
      class="flex flex-wrap items-center gap-2"
    >
      <UInput
        v-if="searchEnabled"
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search…"
        aria-label="Search"
        class="w-64 max-w-full"
        data-testid="admin-search"
      />
      <ResourceFilters
        v-if="filtersEnabled"
        v-model="filters"
        :columns="filterColumns"
      />

      <div class="flex-1" />

      <UButton
        v-if="showBulkDelete"
        color="error"
        variant="soft"
        icon="i-heroicons-trash"
        :disabled="!canDelete"
        data-testid="admin-bulk-delete"
        @click="openBulkDelete"
      >
        Delete selected{{ selectedIds.length ? ` (${selectedIds.length})` : '' }}
      </UButton>

      <UDropdownMenu
        v-if="showExport"
        :items="exportItems"
        :disabled="!canRead || isExporting"
      >
        <UButton
          icon="i-heroicons-arrow-down-tray"
          color="neutral"
          variant="outline"
          :loading="isExporting"
          :disabled="!canRead"
          data-testid="admin-export"
        >
          Export
        </UButton>
      </UDropdownMenu>

      <UButton
        v-if="showImport"
        icon="i-heroicons-arrow-up-tray"
        color="neutral"
        variant="outline"
        :disabled="!canCreate"
        data-testid="admin-import"
        @click="importOpen = true"
      >
        Import
      </UButton>
    </div>

    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center p-12"
    >
      <UIcon
        name="i-heroicons-arrow-path"
        class="animate-spin h-8 w-8 text-primary-500 mb-4"
      />
      <span class="text-gray-600 dark:text-gray-400">Loading data...</span>
    </div>

    <!-- Permission denied state -->
    <PermissionDeniedPage
      v-else-if="error && isPermissionError"
      :message="permissionErrorMessage"
    />

    <!-- Error state (a filter the API refuses is a 400 with its reason) -->
    <div
      v-else-if="error"
      class="p-6"
    >
      <div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <UIcon
          name="i-heroicons-exclamation-circle"
          class="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
        />
        <div>
          <h3 class="font-semibold text-red-900 dark:text-red-200">
            Error Loading Data
          </h3>
          <p class="text-sm text-red-700 dark:text-red-300 mt-1">
            {{ apiErrorMessage(error) }}
          </p>
          <div class="flex gap-2 mt-3">
            <UButton
              variant="soft"
              color="error"
              size="sm"
              @click="refetch"
            >
              Try Again
            </UButton>
            <UButton
              v-if="isFiltered"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="clearQuery"
            >
              Clear search and filters
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <UTable
      v-else
      v-model:row-selection="rowSelection"
      :data="data || []"
      :columns="columns"
      :loading="isFetching"
      :get-row-id="rowId"
    >
      <!-- Empty state -->
      <template #empty>
        <div
          v-if="isFiltered"
          class="text-center py-12 px-4"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No matching records
          </h3>
          <UButton
            variant="soft"
            color="neutral"
            @click="clearQuery"
          >
            Clear search and filters
          </UButton>
        </div>
        <div
          v-else
          class="text-center py-12 px-4"
        >
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <UIcon
              name="i-heroicons-inbox"
              class="h-8 w-8 text-gray-400"
            />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No records found
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Get started by creating your first {{ resourceNameValue }}
          </p>
          <UButton
            v-if="canCreate"
            size="lg"
            icon="i-heroicons-plus"
            @click="handleCreate"
          >
            Create {{ resourceNameValue }}
          </UButton>
        </div>
      </template>
    </UTable>

    <!-- Pagination -->
    <div
      v-if="data && data.length > 0 && meta"
      class="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800"
    >
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Showing <span class="font-medium text-gray-900 dark:text-white">{{ firstRow }}</span> to
        <span class="font-medium text-gray-900 dark:text-white">{{ firstRow + data.length - 1 }}</span>
        <template v-if="meta.total !== undefined">
          of <span class="font-medium text-gray-900 dark:text-white">{{ meta.total }}</span>
        </template>
        results
      </div>

      <UPagination
        v-if="meta.total && meta.limit"
        :page="meta.page || 1"
        :total="meta.total"
        :items-per-page="meta.limit"
        @update:page="handlePageChange"
      />
      <!-- No total (a resource with an objectLevel rule): step through the pages by `hasMore`. -->
      <div
        v-else-if="meta.total === undefined && ((meta.page || 1) > 1 || meta.hasMore)"
        class="flex gap-2"
      >
        <UButton
          icon="i-heroicons-chevron-left"
          color="neutral"
          variant="outline"
          :disabled="(meta.page || 1) <= 1"
          @click="handlePageChange((meta.page || 1) - 1)"
        >
          Previous
        </UButton>
        <UButton
          trailing-icon="i-heroicons-chevron-right"
          color="neutral"
          variant="outline"
          :disabled="!meta.hasMore"
          @click="handlePageChange((meta.page || 1) + 1)"
        >
          Next
        </UButton>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteModal.open">
      <template #body>
        <div class="p-4">
          <h3 class="text-lg font-semibold mb-2">
            Confirm Delete
          </h3>
          <p class="text-gray-600">
            Are you sure you want to delete this {{ resourceNameValue }}? This action cannot be undone.
          </p>
        </div>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end gap-2">
          <UButton
            variant="ghost"
            @click="close"
          >
            Cancel
          </UButton>
          <UButton
            color="error"
            :loading="isDeleting"
            @click="confirmDelete"
          >
            Delete
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Bulk delete confirmation modal -->
    <UModal
      v-model:open="bulkModal.open"
      :title="`Delete ${bulkModal.ids.length} ${resourceLabel}?`"
      description="This action cannot be undone."
    >
      <template #body>
        <div
          v-if="bulkModal.errors.length"
          class="space-y-1 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300"
          data-testid="admin-bulk-errors"
        >
          <p class="font-medium">
            {{ bulkModal.message }}
          </p>
          <p
            v-for="(line, i) in bulkModal.errors"
            :key="i"
          >
            {{ line }}
          </p>
        </div>
        <p
          v-else
          class="text-sm text-gray-600 dark:text-gray-400"
        >
          The selected records on this page will be deleted.
        </p>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end gap-2 w-full">
          <UButton
            variant="ghost"
            @click="close"
          >
            {{ bulkModal.errors.length ? 'Close' : 'Cancel' }}
          </UButton>
          <UButton
            v-if="!bulkModal.errors.length"
            color="error"
            :loading="isBulkDeleting"
            data-testid="admin-bulk-delete-confirm"
            @click="confirmBulkDelete"
          >
            Delete {{ bulkModal.ids.length }}
          </UButton>
        </div>
      </template>
    </UModal>

    <ResourceImportModal
      v-if="showImport"
      v-model:open="importOpen"
      :resource-name="resourceNameValue"
    />
  </div>
</template>

<script setup lang="ts">
import { h, computed, reactive, ref, resolveComponent, unref, watch } from 'vue'
import type { MaybeRef } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { CellContext, HeaderContext } from '@tanstack/vue-table'
import { refDebounced } from '@vueuse/core'
import { formatDisplayValue, formatFieldLabel } from '../utils/fieldTypeMapping'
import { buildListFilter, filterableColumns, parseFilterState, searchFieldsOf, serializeFilterState } from '../utils/listQuery'
import type { FilterState } from '../utils/listQuery'
import { apiErrorMessage, bulkItemErrors, describeItemError } from '../utils/apiErrors'
import type { BulkItemError } from '../utils/apiErrors'
import { collectRows } from '../utils/exportRows'
import type { ListPage } from '../utils/exportRows'
import { downloadFile, parseCsv, toCsv } from '../utils/csv'
import PermissionDeniedPage from './PermissionDeniedPage.vue'
import ResourceFilters from './ResourceFilters.vue'
import ResourceImportModal from './ResourceImportModal.vue'
import { useAdminResource } from '../composables/useAdminResource'
import { useAdminPermissions, useAdminRecordPermissions } from '../composables/useAdminPermissions'
import { useAdminConfig } from '../composables/useAdminConfig'
import { useAutoApiList, useAutoApiBulkDelete, useAutoApiPath } from '@websideproject/nuxt-auto-api/composables'
import type { BulkOperationResponse } from '@websideproject/nuxt-auto-api/composables'
import { useAdminActions } from '../composables/useAdminActions'
// Explicit: Nuxt does not auto-import into files inside node_modules, which is where this module runs from.
import { useRoute, useRouter } from '#app'
import { useToast } from '#imports'

const UButton = resolveComponent('UButton')
const UCheckbox = resolveComponent('UCheckbox')
const UDropdownMenu = resolveComponent('UDropdownMenu')

/** Client-side export stops here — the same default cap as nuxt-auto-api's export route. */
const EXPORT_MAX_ROWS = 10000
const PAGE_SIZE = 20

const props = defineProps<{
  resourceName: MaybeRef<string>
}>()

const emit = defineEmits<{
  create: []
  view: [id: string | number]
  edit: [id: string | number]
}>()

// Unwrap the resource name in case it's a ref
const resourceNameValue = computed(() => unref(props.resourceName))

const route = useRoute()
const router = useRouter()
const toast = useToast()
const apiPath = useAutoApiPath()

const { resource } = useAdminResource(resourceNameValue.value)
// False until /permissions answers: the UI never offers an action before the API says it is allowed.
const { permissions, canCreate, canRead, canDelete, isLoading: permissionsLoading } = useAdminPermissions(resourceNameValue.value)
const { features, api, permissions: permissionConfig } = useAdminConfig()

const resourceLabel = computed(() => resource.value?.displayName?.toLowerCase() || resourceNameValue.value)
const pk = computed(() => resource.value?.primaryKey || 'id')

// ─── Search & filters ──────────────────────────────────────────────────────
// Only the columns the list shows and the caller may read: the API refuses any other field with a 400.
const filterColumns = computed(() => resource.value ? filterableColumns(resource.value, permissions.value?.fields) : [])
const searchFields = computed(() => searchFieldsOf(filterColumns.value))
const searchEnabled = computed(() => features.search !== false && searchFields.value.length > 0)
const filtersEnabled = computed(() => features.filters !== false && filterColumns.value.length > 0)

// Search, filters and page live in the query string, so a filtered list can be reloaded and shared.
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const filters = ref<FilterState>(parseFilterState(route.query.filters))
const page = ref(Number(route.query.page) || 1)

// Typing waits for a pause before the list is queried.
const debouncedSearch = refDebounced(search, 300)
const debouncedFilters = refDebounced(filters, 300)
const listFilter = computed(() => buildListFilter({
  columns: filtersEnabled.value ? filterColumns.value : [],
  filters: debouncedFilters.value,
  search: searchEnabled.value ? debouncedSearch.value : '',
  searchFields: searchFields.value,
}))
const isFiltered = computed(() => !!listFilter.value)

// A new search or filter starts at the first page.
watch([debouncedSearch, debouncedFilters], () => {
  page.value = 1
})

watch([search, filters, page], () => {
  const { q: _q, filters: _f, page: _p, ...rest } = route.query
  router.replace({
    query: {
      ...rest,
      ...(search.value ? { q: search.value } : {}),
      ...(serializeFilterState(filters.value) ? { filters: serializeFilterState(filters.value) } : {}),
      ...(page.value > 1 ? { page: String(page.value) } : {}),
    },
  })
}, { deep: true })

function clearQuery() {
  search.value = ''
  filters.value = {}
}

// ─── List data ─────────────────────────────────────────────────────────────
const queryParams = computed(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(listFilter.value ? { filter: listFilter.value } : {}),
}))

// The filter needs the registry and the caller's readable fields: query once both are known.
const ready = computed(() => !!resource.value && !permissionsLoading.value)
const { data: response, isLoading: listLoading, isFetching, error, refetch } = useAutoApiList(
  resourceNameValue.value,
  queryParams,
  // Keep showing the previous page while the next one loads, instead of a spinner on every keystroke.
  { enabled: ready, placeholderData: (previous: any) => previous },
)
const isLoading = computed(() => !ready.value || listLoading.value)

const data = computed(() => response.value?.data || [])
// Per-row Edit / Delete: one request for the page's rows (the row's objectLevel rule may refuse what the
// resource allows).
const { canUpdateRow, canDeleteRow } = useAdminRecordPermissions(resourceNameValue.value, () => data.value.map(row => row[pk.value] as string | number))
const meta = computed(() => response.value?.meta)
const firstRow = computed(() => ((meta.value?.page || 1) - 1) * (meta.value?.limit || PAGE_SIZE) + 1)

interface ApiError {
  statusCode?: number
  message?: string
  response?: { status: number }
}

// Check if error is a permission error (401 or 403)
const isPermissionError = computed(() => {
  if (!error.value) return false
  const errorObj = error.value as ApiError
  const statusCode = errorObj?.statusCode || errorObj?.response?.status
  return statusCode === 401 || statusCode === 403
})

const permissionErrorMessage = computed(() => {
  if (!error.value) return ''
  const errorObj = error.value as ApiError
  const statusCode = errorObj?.statusCode || errorObj?.response?.status
  if (statusCode === 401) {
    return errorObj?.message || 'Authentication required. Please log in to access this resource.'
  }
  return errorObj?.message || `You don't have permission to access ${resourceNameValue.value}`
})

// ─── Toolbar visibility ────────────────────────────────────────────────────
// A button the caller may not use is hidden or shown disabled, per `permissions.unauthorizedButtons`.
const showUnauthorized = computed(() => (permissionConfig.unauthorizedButtons || 'disable') === 'disable')
const bulkEnabled = computed(() => features.bulkActions !== false && api.bulk)
const selectable = computed(() => bulkEnabled.value && canDelete.value)
const showExport = computed(() => features.export !== false && (canRead.value || showUnauthorized.value))
const showImport = computed(() => features.import === true && api.bulk && (canCreate.value || showUnauthorized.value))

// ─── Selection & bulk delete ───────────────────────────────────────────────
const rowSelection = ref<Record<string, boolean>>({})
const rowId = (row: Record<string, unknown>) => String(row[pk.value])
// Selection is per page: nothing off-screen is ever deleted.
watch([page, listFilter], () => {
  rowSelection.value = {}
})
const selectedIds = computed(() => data.value
  .filter(row => rowSelection.value[rowId(row)] && canDeleteRow(row[pk.value] as string | number))
  .map(row => row[pk.value] as string | number))
const showBulkDelete = computed(() => bulkEnabled.value && (canDelete.value ? selectedIds.value.length > 0 : showUnauthorized.value))

const { mutateAsync: bulkDelete, isPending: isBulkDeleting } = useAutoApiBulkDelete(resourceNameValue.value)
const bulkModal = reactive({
  open: false,
  ids: [] as Array<string | number>,
  message: '',
  errors: [] as string[],
})

function openBulkDelete() {
  Object.assign(bulkModal, { open: true, ids: selectedIds.value, message: '', errors: [] })
}

async function confirmBulkDelete() {
  const ids = bulkModal.ids
  let result: BulkOperationResponse
  try {
    result = await bulkDelete(ids)
  }
  catch (err) {
    // Transactional mode (the default): nothing was deleted; the API names the item that failed.
    const items = bulkItemErrors(err)
    bulkModal.message = items.length ? 'Nothing was deleted.' : apiErrorMessage(err)
    bulkModal.errors = items.length ? items.map(item => describeItemError(item)) : [apiErrorMessage(err)]
    return
  }
  rowSelection.value = {}
  const failed: BulkItemError[] = result.meta?.errors ?? []
  if (failed.length) {
    // `bulk.transactional: false`: the others were deleted.
    bulkModal.message = `${result.meta.successful} deleted, ${failed.length} failed.`
    bulkModal.errors = failed.map(item => describeItemError(item))
    return
  }
  bulkModal.open = false
  toast.add({ title: `${result.meta?.successful ?? ids.length} ${resourceLabel.value} deleted`, icon: 'i-heroicons-check-circle', color: 'success' })
}

// ─── Export ────────────────────────────────────────────────────────────────
// `createExportPlugin`'s route when the app registered it for this resource; otherwise the list, page by page.
const exportRoute = computed(() => {
  const route = api.export
  return route && (!route.resources || route.resources.includes(resourceNameValue.value)) ? route : null
})
const exportItems = computed(() => (exportRoute.value?.formats ?? ['csv', 'json']).map(format => ({
  label: format === 'csv' ? 'CSV' : 'JSON',
  icon: format === 'csv' ? 'i-heroicons-table-cells' : 'i-heroicons-code-bracket',
  onSelect: () => exportAs(format),
})))
const isExporting = ref(false)

async function exportAs(format: 'csv' | 'json') {
  isExporting.value = true
  // The list as it is filtered now (the same `filter` the table was loaded with).
  const query = listFilter.value ? { filter: JSON.stringify(listFilter.value) } : {}
  try {
    let content: string
    let count: number
    let cap: number
    if (exportRoute.value) {
      cap = exportRoute.value.maxRows
      const url = apiPath(resourceNameValue.value, 'export')
      if (format === 'csv') {
        content = await $fetch<string>(url, { query: { ...query, format }, responseType: 'text' })
        count = Math.max(0, parseCsv(content).length - 1)
      }
      else {
        const res = await $fetch<{ data: unknown[] }>(url, { query: { ...query, format } })
        content = JSON.stringify(res.data, null, 2)
        count = res.data.length
      }
    }
    else {
      cap = EXPORT_MAX_ROWS
      const { rows } = await collectRows<Record<string, unknown>>(
        (cursor, limit) => $fetch<ListPage<Record<string, unknown>>>(apiPath(resourceNameValue.value), { query: { ...query, cursor, limit } }),
        api.maxLimit,
        cap,
      )
      content = format === 'csv' ? toCsv(rows) : JSON.stringify(rows, null, 2)
      count = rows.length
    }
    downloadFile(content, `${resourceNameValue.value}.${format}`, format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json')
    toast.add({
      title: `Exported ${count} ${resourceLabel.value}`,
      ...(count >= cap ? { description: `Exports stop at ${cap} rows — narrow the list with filters to export the rest.`, color: 'warning' as const } : { color: 'success' as const }),
      icon: 'i-heroicons-arrow-down-tray',
    })
  }
  catch (err) {
    toast.add({ title: 'Export failed', description: apiErrorMessage(err), icon: 'i-heroicons-exclamation-circle', color: 'error' })
  }
  finally {
    isExporting.value = false
  }
}

// ─── Import ────────────────────────────────────────────────────────────────
const importOpen = ref(false)

const showToolbar = computed(() => searchEnabled.value || filtersEnabled.value || showBulkDelete.value || showExport.value || showImport.value)

// ─── Row actions ───────────────────────────────────────────────────────────
const { handleDelete: deleteResource, isDeleting } = useAdminActions(resourceNameValue.value)

const deleteModal = reactive({
  open: false,
  itemId: null as string | number | null,
})

// Build columns dynamically from resource schema
const columns = computed<TableColumn<Record<string, unknown>>[]>(() => {
  if (!resource.value) return []

  const cols: TableColumn<Record<string, unknown>>[] = []

  if (selectable.value) {
    cols.push({
      id: 'select',
      header: ({ table }: HeaderContext<Record<string, unknown>, unknown>) => h(UCheckbox, {
        'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
        'aria-label': 'Select all',
      }),
      cell: ({ row }: CellContext<Record<string, unknown>, unknown>) => h(UCheckbox, {
        'modelValue': row.getIsSelected() && canDeleteRow(row.original[pk.value] as string | number),
        'disabled': !canDeleteRow(row.original[pk.value] as string | number),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'aria-label': 'Select row',
      }),
    })
  }

  // Add data columns based on listFields
  resource.value.listFields.forEach((fieldName) => {
    const column = resource.value!.columns.find(col => col.name === fieldName)

    cols.push({
      accessorKey: fieldName,
      header: formatFieldLabel(fieldName),
      cell: ({ row }: CellContext<Record<string, unknown>, unknown>) => {
        const value = row.getValue(fieldName)

        // Handle boolean values with badges
        if (column && typeof value === 'boolean') {
          return h(
            'span',
            {
              class: value
                ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
            },
            value ? 'Yes' : 'No',
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
              class: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`,
            },
            value,
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
    cell: ({ row }: CellContext<Record<string, unknown>, unknown>) => {
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
            disabled: !canUpdateRow(row.original[pk.value] as string | number),
            onSelect: () => handleEdit(row.original),
          },
          {
            label: 'Delete',
            icon: 'i-heroicons-trash',
            disabled: !canDeleteRow(row.original[pk.value] as string | number),
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
          }),
      )
    },
  })

  return cols
})

function handlePageChange(newPage: number) {
  page.value = newPage
}

function handleCreate() {
  emit('create')
}

function handleView(item: Record<string, unknown>) {
  emit('view', item[pk.value] as string | number)
}

function handleEdit(item: Record<string, unknown>) {
  emit('edit', item[pk.value] as string | number)
}

function openDeleteModal(item: Record<string, unknown>) {
  deleteModal.itemId = item[pk.value] as string | number
  deleteModal.open = true
}

async function confirmDelete() {
  if (!deleteModal.itemId) return

  try {
    await deleteResource(deleteModal.itemId)
    deleteModal.open = false
    deleteModal.itemId = null
    refetch()
  }
  catch {
    // Error is handled by useAdminActions
  }
}
</script>
