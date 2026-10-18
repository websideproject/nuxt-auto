<template>
  <UCard
    class="admin-widget border-default/60 h-full"
    :ui="{ body: 'h-full' }"
  >
    <component
      :is="customComponent"
      v-if="widget.type === 'custom'"
      v-bind="widget.props"
    />

    <template v-else>
      <div class="flex items-center justify-between gap-2 mb-2">
        <h3 class="text-sm font-medium text-muted truncate">
          {{ title }}
        </h3>
        <NuxtLink
          v-if="resource"
          :to="`${prefix}/${widget.resource}`"
          class="text-xs text-dimmed hover:text-primary"
        >
          View all
        </NuxtLink>
      </div>

      <USkeleton
        v-if="isLoading"
        class="h-16"
      />
      <p
        v-else-if="error"
        class="text-sm text-muted"
      >
        {{ apiStatus(error) === 403 || apiStatus(error) === 401 ? 'You cannot see this data.' : apiErrorMessage(error) }}
      </p>

      <!-- stat -->
      <div
        v-else-if="widget.type === 'stat'"
        class="text-3xl font-semibold text-highlighted"
      >
        {{ formatStat(statValue) }}
      </div>

      <!-- chart -->
      <div
        v-else-if="widget.type === 'chart'"
        class="space-y-1.5"
      >
        <div
          v-for="bar in bars"
          :key="bar.label"
          class="flex items-center gap-2 text-sm"
        >
          <span class="w-28 shrink-0 truncate text-muted">{{ bar.label }}</span>
          <div class="flex-1 h-4 rounded bg-elevated overflow-hidden">
            <div
              class="h-full rounded bg-primary"
              :style="{ width: `${Math.max(2, bar.share * 100)}%` }"
            />
          </div>
          <span class="w-14 shrink-0 text-right tabular-nums text-highlighted">{{ formatStat(bar.value) }}</span>
        </div>
        <p
          v-if="!bars.length"
          class="text-sm text-muted"
        >
          No data
        </p>
      </div>

      <!-- activity -->
      <ul
        v-else-if="widget.type === 'activity'"
        class="divide-y divide-default/60"
      >
        <li
          v-for="row in records"
          :key="String(row[primaryKey])"
          class="py-1.5"
        >
          <NuxtLink
            :to="`${prefix}/${widget.resource}/${row[primaryKey]}`"
            class="flex items-center justify-between gap-2 text-sm hover:text-primary"
          >
            <span class="truncate text-highlighted">{{ row[displayField] ?? `#${row[primaryKey]}` }}</span>
            <span
              v-if="row.createdAt"
              class="shrink-0 text-xs text-dimmed"
            >{{ new Date(row.createdAt).toLocaleDateString() }}</span>
          </NuxtLink>
        </li>
        <li
          v-if="!records.length"
          class="py-1.5 text-sm text-muted"
        >
          Nothing yet
        </li>
      </ul>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAutoApiAggregate, useAutoApiList } from '@websideproject/nuxt-auto-api/composables'
import { widgetComponents } from '#nuxt-auto-admin-dashboard'
import type { DashboardWidget } from '../types'
import { useAdminConfig } from '../composables/useAdminConfig'
import { useAdminRegistry } from '../composables/useAdminRegistry'
import { apiErrorMessage, apiStatus } from '../utils/apiErrors'
import { chartBars, formatStat, widgetAggregate } from '../utils/dashboard'

const props = defineProps<{
  widget: DashboardWidget
  /** Position in `dashboard.widgets` (a custom widget's component is registered by it) */
  index: number
}>()

const { prefix } = useAdminConfig()
const { getResource } = useAdminRegistry()
const resource = computed(() => (props.widget.resource ? getResource(props.widget.resource) : undefined))
const title = computed(() => props.widget.label || resource.value?.displayName || props.widget.resource || '')
const customComponent = computed(() => widgetComponents[props.index])

const kind = props.widget.type
const { aggregate, key } = widgetAggregate(props.widget)
const needsAggregate = (kind === 'stat' || kind === 'chart') && !!props.widget.resource

const aggregateQuery = useAutoApiAggregate(props.widget.resource || '', {
  aggregate,
  ...(kind === 'chart' && props.widget.groupBy ? { groupBy: props.widget.groupBy } : {}),
  ...(props.widget.filter ? { filter: props.widget.filter as Record<string, any> } : {}),
}, { enabled: needsAggregate, retry: false })

const primaryKey = computed(() => resource.value?.primaryKey || 'id')
const displayField = computed(() => {
  const columns = resource.value?.columns.map(c => c.name) ?? []
  return ['title', 'name', 'displayName', 'email', 'label'].find(c => columns.includes(c)) || primaryKey.value
})
const listQuery = useAutoApiList(props.widget.resource || '', {
  limit: props.widget.limit || 5,
  sort: resource.value?.columns.some(c => c.name === 'createdAt') ? '-createdAt' : `-${primaryKey.value}`,
  ...(props.widget.filter ? { filter: props.widget.filter as Record<string, any> } : {}),
}, { enabled: kind === 'activity' && !!props.widget.resource, retry: false })

const active = kind === 'activity' ? listQuery : aggregateQuery
const isLoading = computed(() => kind !== 'custom' && active.isLoading.value)
const error = computed(() => (kind === 'custom' ? null : active.error.value))

const statValue = computed(() => (aggregateQuery.data.value as any)?.data?.[0]?.[key])
const bars = computed(() => chartBars((aggregateQuery.data.value as any)?.data ?? [], key, props.widget.limit || 10))
const records = computed(() => ((listQuery.data.value as any)?.data ?? []) as Array<Record<string, any>>)
</script>
