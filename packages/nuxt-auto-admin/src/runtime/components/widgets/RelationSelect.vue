<template>
  <USelectMenu
    v-model:search-term="searchTerm"
    :model-value="modelValue"
    :items="allOptions"
    :loading="isLoading || isLoadingSelected"
    :disabled="readonly || isLoading"
    :required="required"
    :placeholder="placeholder || 'Select a related item'"
    value-key="value"
    ignore-filter
    class="w-full"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { WidgetOptions } from '../../types'

const props = defineProps<{
  modelValue?: string | number
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

defineEmits<{
  'update:modelValue': [value: string | number]
}>()

// Extract foreign key resource information
const relationResource = computed(() => props.options?.resource)
const displayField = computed(() => props.options?.displayField || 'name')
const searchField = computed(() => props.options?.searchFields?.[0] || displayField.value)

// Search term for filtering with debouncing
const searchTerm = ref('')
const debouncedSearchTerm = refDebounced(searchTerm, 300)

// Create reactive filter params
const filterParams = computed(() => {
  if (!debouncedSearchTerm.value) return undefined

  // Build filter with $like operator
  // Note: buildWhereClause adds % wildcards automatically
  return {
    filter: {
      [searchField.value]: {
        $like: debouncedSearchTerm.value
      }
    }
  }
})

// Fetch filtered list based on search
const { data: relationData, isLoading } = useAutoApiList(
  relationResource.value || '',
  filterParams,
  {
    enabled: computed(() => !!relationResource.value),
  }
)

// Fetch the currently selected item if not in the list
// This ensures we can display the selected value even if it's not in search results
const {
  data: selectedItemData,
  isLoading: isLoadingSelected
} = useAutoApiGet(
  relationResource.value || '',
  computed(() => props.modelValue!),
  undefined,
  {
    enabled: computed(() => !!relationResource.value && !!props.modelValue),
  }
)

// Transform search results into select options
const searchOptions = computed(() => {
  if (!relationData.value?.data) return []

  return relationData.value.data.map((item: any) => ({
    label: item[displayField.value] || item.id || 'Unknown',
    value: item.id,
  }))
})

// Selected item as an option
const selectedOption = computed(() => {
  if (!props.modelValue || !selectedItemData.value?.data) return null

  const item = selectedItemData.value.data
  return {
    label: item[displayField.value] || item.id || 'Unknown',
    value: item.id,
  }
})

// Combine selected option with search results (avoid duplicates)
const allOptions = computed(() => {
  const options = [...searchOptions.value]

  // Add selected option at the top if it exists and isn't already in the list
  if (selectedOption.value && !options.some(opt => opt.value === selectedOption.value.value)) {
    options.unshift(selectedOption.value)
  }

  return options
})
</script>
