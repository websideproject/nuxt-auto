<template>
  <UModal
    v-model:open="isOpen"
    :title="`Import ${resource?.displayName || resourceName}`"
    description="Upload a CSV file, match its columns to fields, then create the records."
    :ui="{ content: 'w-full max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- 1. File -->
        <div>
          <input
            type="file"
            accept=".csv,text/csv"
            class="block w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:px-3 file:py-1.5 file:text-sm"
            data-testid="admin-import-file"
            :disabled="isRunning"
            @change="onFile"
          >
          <p
            v-if="fileError"
            class="mt-2 text-sm text-red-600 dark:text-red-400"
          >
            {{ fileError }}
          </p>
          <p
            v-if="!fields.length"
            class="mt-2 text-sm text-gray-500"
          >
            This resource has no fields you may set.
          </p>
        </div>

        <!-- 2. Mapping and preview -->
        <template v-if="headers.length && !results.length">
          <div>
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Columns
            </h4>
            <div class="grid grid-cols-2 gap-2 items-center">
              <template
                v-for="(header, index) in headers"
                :key="index"
              >
                <span class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ header || `Column ${index + 1}` }}</span>
                <USelectMenu
                  :model-value="mapping[index] ?? SKIP"
                  :items="fieldItems"
                  value-key="value"
                  label-key="label"
                  :search-input="false"
                  :data-testid="`admin-import-map-${index}`"
                  @update:model-value="setMapping(index, $event)"
                />
              </template>
            </div>
          </div>

          <div v-if="mappedFields.length">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Preview ({{ Math.min(PREVIEW_ROWS, items.length) }} of {{ items.length }} rows)
            </h4>
            <div class="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-md">
              <table class="min-w-full text-xs">
                <thead class="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th
                      v-for="field in mappedFields"
                      :key="field"
                      class="px-2 py-1 text-left font-medium"
                    >
                      {{ formatFieldLabel(field) }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, i) in items.slice(0, PREVIEW_ROWS)"
                    :key="i"
                    class="border-t border-gray-200 dark:border-gray-800"
                  >
                    <td
                      v-for="field in mappedFields"
                      :key="field"
                      class="px-2 py-1"
                    >
                      {{ item[field] === undefined ? '' : String(item[field]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- 3. Results -->
        <div
          v-if="results.length"
          class="space-y-2"
          data-testid="admin-import-results"
        >
          <div
            v-for="result in results"
            :key="result.batch"
            class="text-sm"
            :class="result.errors.length ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'"
          >
            <p>
              Rows {{ result.from }}–{{ result.to }}: {{ result.summary }}
            </p>
            <p
              v-for="(line, i) in result.errors"
              :key="i"
              class="pl-4"
            >
              {{ line }}
            </p>
          </div>
          <p
            v-if="stoppedEarly"
            class="text-sm text-gray-600 dark:text-gray-400"
          >
            The import stopped at the failed batch; the rows after it were not sent.
          </p>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex justify-end gap-2 w-full">
        <UButton
          variant="ghost"
          :disabled="isRunning"
          @click="close"
        >
          {{ results.length ? 'Close' : 'Cancel' }}
        </UButton>
        <UButton
          v-if="!results.length"
          icon="i-heroicons-arrow-up-tray"
          :loading="isRunning"
          :disabled="!items.length || !mappedFields.length"
          data-testid="admin-import-run"
          @click="runImport"
        >
          Import {{ items.length }} rows
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAutoApiBulkCreate } from '@websideproject/nuxt-auto-api/composables'
import { useResourceForm } from '../composables/useResourceForm'
import { useAdminConfig } from '../composables/useAdminConfig'
import { formatFieldLabel } from '../utils/fieldTypeMapping'
import { parseCsv } from '../utils/csv'
import { autoMap, mapRows, toBatches } from '../utils/importRows'
import type { ImportField, ImportMapping } from '../utils/importRows'
import { apiErrorMessage, bulkItemErrors, describeItemError } from '../utils/apiErrors'

const PREVIEW_ROWS = 5
// USelectMenu items cannot carry an empty value: "skip this column" needs a value of its own.
const SKIP = '__skip__'

const props = defineProps<{
  resourceName: string
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const { api } = useAdminConfig()
// The create form's fields, minus those the caller may not write (`useResourceForm` marks them read-only).
const { fields: formFields, resource } = useResourceForm(props.resourceName, 'create')
const fields = computed<ImportField[]>(() => formFields.value
  .filter(field => !field.readonly)
  .map(field => ({
    name: field.name,
    label: field.label || formatFieldLabel(field.name),
    column: resource.value?.columns.find(col => col.name === field.name),
  })))
const fieldItems = computed(() => [{ label: 'Skip this column', value: SKIP }, ...fields.value.map(f => ({ label: f.label, value: f.name }))])

const headers = ref<string[]>([])
const rows = ref<string[][]>([])
const mapping = ref<ImportMapping>([])
const fileError = ref('')

const mappedFields = computed(() => mapping.value.filter((field): field is string => !!field))
const items = computed(() => mapRows(rows.value, mapping.value, fields.value))

interface BatchResult {
  batch: number
  from: number
  to: number
  summary: string
  errors: string[]
}
const results = ref<BatchResult[]>([])
const stoppedEarly = ref(false)
const isRunning = ref(false)

// A fresh start each time the dialog opens.
watch(isOpen, (open) => {
  if (!open || isRunning.value) return
  headers.value = []
  rows.value = []
  mapping.value = []
  fileError.value = ''
  results.value = []
  stoppedEarly.value = false
})

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  results.value = []
  fileError.value = ''
  headers.value = []
  rows.value = []
  if (!file) return
  const parsed = parseCsv(await file.text())
  if (parsed.length < 2) {
    fileError.value = 'The file needs a header row and at least one data row.'
    return
  }
  headers.value = parsed[0]!
  rows.value = parsed.slice(1)
  mapping.value = autoMap(headers.value, fields.value)
}

function setMapping(index: number, value: unknown) {
  const field = typeof value === 'string' && value !== SKIP ? value : null
  // One CSV column per field: mapping a field here unmaps it elsewhere.
  const next = mapping.value.map(f => (field && f === field ? null : f))
  next[index] = field
  mapping.value = next
}

const { mutateAsync: bulkCreate } = useAutoApiBulkCreate(props.resourceName)

async function runImport() {
  isRunning.value = true
  results.value = []
  stoppedEarly.value = false
  // Batches of the API's `bulk.maxBatchSize`, one after the other.
  const batches = toBatches(items.value, api.maxBatchSize)
  let offset = 0
  try {
    for (const [i, batch] of batches.entries()) {
      const from = offset + 1
      const to = offset + batch.length
      try {
        const res = await bulkCreate(batch)
        const failed = res.meta?.errors ?? []
        results.value.push({
          batch: i,
          from,
          to,
          summary: failed.length ? `${res.meta.successful} created, ${failed.length} failed` : `${res.meta?.successful ?? batch.length} created`,
          // `bulk.transactional: false` reports each failed row and writes the rest.
          errors: failed.map(item => describeItemError(item, offset, 'Row')),
        })
      }
      catch (err) {
        // Transactional (the default): nothing of this batch was written; the API names the row that failed.
        const itemErrors = bulkItemErrors(err)
        results.value.push({
          batch: i,
          from,
          to,
          summary: 'not imported',
          errors: itemErrors.length ? itemErrors.map(item => describeItemError(item, offset, 'Row')) : [apiErrorMessage(err)],
        })
        stoppedEarly.value = i < batches.length - 1
        return
      }
      offset += batch.length
    }
  }
  finally {
    isRunning.value = false
  }
}
</script>
