<template>
  <!-- The log is optional: when the route is missing or the caller may not read it, a quiet note — never an error page. -->
  <UCard
    v-if="!unavailable || isLoading"
    class="border-gray-200/60 dark:border-gray-800/60"
    data-testid="admin-audit-log"
  >
    <template #header>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        History
      </h3>
    </template>

    <p
      v-if="isLoading"
      class="text-sm text-gray-500"
    >
      Loading…
    </p>
    <p
      v-else-if="error"
      class="text-sm text-gray-500"
    >
      History could not be loaded: {{ apiErrorMessage(error) }}
    </p>
    <p
      v-else-if="!entries.length"
      class="text-sm text-gray-500"
    >
      No recorded changes.
    </p>
    <ol
      v-else
      class="space-y-3"
    >
      <li
        v-for="(entry, i) in entries"
        :key="entry.id ?? i"
        class="text-sm"
      >
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            size="sm"
            variant="subtle"
            :color="entry.operation === 'delete' ? 'error' : entry.operation === 'create' ? 'success' : 'neutral'"
          >
            {{ entry.operation }}
          </UBadge>
          <span class="text-gray-900 dark:text-white">{{ formatTime(entry.timestamp) }}</span>
          <span
            v-if="entry.userId"
            class="text-gray-500"
          >by {{ entry.userId }}</span>
        </div>
        <p
          v-if="changedFields(entry).length"
          class="mt-1 text-gray-600 dark:text-gray-400"
        >
          Changed: {{ changedFields(entry).map(formatFieldLabel).join(', ') }}
        </p>
      </li>
    </ol>
    <p
      v-if="entries.length >= LIMIT"
      class="mt-3 text-xs text-gray-500"
    >
      The latest {{ LIMIT }} changes.
    </p>
  </UCard>
  <p
    v-else
    class="text-xs text-gray-500"
  >
    History is not available for this record.
  </p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAutoApiEndpointQuery, useAutoApiPath } from '@websideproject/nuxt-auto-api/composables'
import { changedFields } from '../utils/auditLog'
import type { AuditEntry } from '../utils/auditLog'
import { apiErrorMessage, apiStatus } from '../utils/apiErrors'
import { formatFieldLabel } from '../utils/fieldTypeMapping'

const LIMIT = 20

const props = defineProps<{
  resourceName: string
  recordId: string | number
}>()

const path = useAutoApiPath()
// GET /api/audit-logs (createAuditLogPlugin): the log table's list, through its own `read` permission.
const { data, error, isLoading } = useAutoApiEndpointQuery<{ data: AuditEntry[] }>(
  path('audit-logs'),
  computed(() => ({ resource: props.resourceName, recordId: String(props.recordId), limit: LIMIT })),
  // Under the resource's key, so an edit of the record refreshes its history.
  { queryKey: computed(() => ['autoapi', props.resourceName, 'auditLog', String(props.recordId)]) },
)

const entries = computed(() => data.value?.data ?? [])
const unavailable = computed(() => [401, 403, 404].includes(apiStatus(error.value) ?? 0))

function formatTime(value: AuditEntry['timestamp']): string {
  if (value === undefined || value === null) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}
</script>
