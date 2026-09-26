<template>
  <UPopover :content="{ align: 'start' }">
    <UButton
      icon="i-heroicons-funnel"
      color="neutral"
      variant="outline"
      data-testid="admin-filters"
    >
      Filters
      <UBadge
        v-if="count"
        size="sm"
        variant="subtle"
      >
        {{ count }}
      </UBadge>
    </UButton>

    <template #content>
      <div class="p-4 space-y-3 w-80 max-h-[70vh] overflow-y-auto">
        <div
          v-for="column in columns"
          :key="column.name"
          class="space-y-1"
        >
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ formatFieldLabel(column.name) }}</label>
            <UButton
              v-if="isSet(column.name)"
              size="xs"
              variant="link"
              color="neutral"
              :aria-label="`Clear ${formatFieldLabel(column.name)} filter`"
              @click="clear(column.name)"
            >
              Clear
            </UButton>
          </div>

          <UInput
            v-if="column.kind === 'text'"
            :model-value="text(column.name)"
            placeholder="Contains…"
            class="w-full"
            :data-testid="`admin-filter-${column.name}`"
            @update:model-value="set(column.name, String($event ?? ''))"
          />
          <USelectMenu
            v-else-if="column.kind === 'enum' || column.kind === 'boolean'"
            :model-value="text(column.name) || undefined"
            :items="column.kind === 'enum' ? (column.enumValues ?? []).map(value => ({ label: value, value })) : BOOLEAN_ITEMS"
            value-key="value"
            label-key="label"
            placeholder="Any"
            :search-input="false"
            class="w-full"
            :data-testid="`admin-filter-${column.name}`"
            @update:model-value="set(column.name, String($event ?? ''))"
          />
          <div
            v-else
            class="flex gap-2"
          >
            <UInput
              :model-value="bound(column.name, 'min')"
              :type="column.kind"
              :placeholder="column.kind === 'date' ? 'From' : 'Min'"
              :aria-label="`${formatFieldLabel(column.name)} ${column.kind === 'date' ? 'from' : 'minimum'}`"
              class="flex-1"
              :data-testid="`admin-filter-${column.name}-min`"
              @update:model-value="setBound(column.name, 'min', $event)"
            />
            <UInput
              :model-value="bound(column.name, 'max')"
              :type="column.kind"
              :placeholder="column.kind === 'date' ? 'To' : 'Max'"
              :aria-label="`${formatFieldLabel(column.name)} ${column.kind === 'date' ? 'to' : 'maximum'}`"
              class="flex-1"
              :data-testid="`admin-filter-${column.name}-max`"
              @update:model-value="setBound(column.name, 'max', $event)"
            />
          </div>
        </div>

        <div class="flex justify-end pt-1">
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            :disabled="!count"
            @click="emit('update:modelValue', {})"
          >
            Clear all
          </UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatFieldLabel } from '../utils/fieldTypeMapping'
import { activeFilterCount } from '../utils/listQuery'
import type { FilterableColumn, FilterState } from '../utils/listQuery'

const BOOLEAN_ITEMS = [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]

const props = defineProps<{
  columns: FilterableColumn[]
  modelValue: FilterState
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FilterState]
}>()

const count = computed(() => activeFilterCount(props.modelValue))

function text(name: string): string {
  const value = props.modelValue[name]
  return typeof value === 'string' ? value : ''
}

function bound(name: string, side: 'min' | 'max'): string {
  const value = props.modelValue[name]
  return typeof value === 'object' ? value[side] ?? '' : ''
}

function isSet(name: string): boolean {
  return activeFilterCount({ [name]: props.modelValue[name] ?? '' }) > 0
}

function set(name: string, value: string) {
  emit('update:modelValue', { ...props.modelValue, [name]: value })
}

function setBound(name: string, side: 'min' | 'max', value: string | number | null | undefined) {
  const current = props.modelValue[name]
  const range = typeof current === 'object' ? current : {}
  emit('update:modelValue', { ...props.modelValue, [name]: { ...range, [side]: value == null ? '' : String(value) } })
}

function clear(name: string) {
  const { [name]: _removed, ...rest } = props.modelValue
  emit('update:modelValue', rest)
}
</script>
