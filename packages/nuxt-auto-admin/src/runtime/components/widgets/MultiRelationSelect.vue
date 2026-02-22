<template>
  <USelectMenu
    v-model:search-term="searchTerm"
    :model-value="modelValue"
    :items="allOptions"
    :loading="isLoading || isLoadingSelected"
    :disabled="readonly || isLoading"
    :required="required"
    :placeholder="placeholder || 'Select items'"
    value-key="value"
    ignore-filter
    multiple
    class="w-full"
    @update:model-value="handleUpdate"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { WidgetOptions } from '../../types'

const props = defineProps<{
  modelValue?: (string | number)[]
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

const emit = defineEmits<{
  'update:modelValue': [value: (string | number)[]]
}>()

// Extract relation information
const relationResource = computed(() => props.options?.resource)
const displayField = computed(() => props.options?.displayField || 'name')
const searchField = computed(() => props.options?.searchFields?.[0] || displayField.value)

// Search term for filtering with debouncing
const searchTerm = ref('')
const debouncedSearchTerm = refDebounced(searchTerm, 300)

// Create reactive filter params
const filterParams = computed(() => {
  if (!debouncedSearchTerm.value) return undefined

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

// Fetch currently selected items to display them
const selectedIds = computed(() => props.modelValue || [])

// We'll fetch selected items individually if needed
// For now, we assume they're in the search results or initial load
const { data: initialData, isLoading: isLoadingSelected } = useAutoApiList(
  relationResource.value || '',
  computed(() => selectedIds.value.length > 0 ? {
    filter: {
      id: { $in: selectedIds.value.join(',') }
    }
  } : undefined),
  {
    enabled: computed(() => !!relationResource.value && selectedIds.value.length > 0),
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

// Selected items as options
const selectedOptions = computed(() => {
  if (!initialData.value?.data) return []

  return initialData.value.data.map((item: any) => ({
    label: item[displayField.value] || item.id || 'Unknown',
    value: item.id,
  }))
})

// Combine selected options with search results (avoid duplicates)
const allOptions = computed(() => {
  const options = [...searchOptions.value]

  // Add selected options if not already in search results
  selectedOptions.value.forEach(selectedOption => {
    if (!options.some(opt => opt.value === selectedOption.value)) {
      options.unshift(selectedOption)
    }
  })

  return options
})

// Handle update - USelectMenu with multiple returns array of IDs when value-key is set
function handleUpdate(values: any) {
  if (Array.isArray(values)) {
    emit('update:modelValue', values)
  } else {
    emit('update:modelValue', [])
  }
}
</script>
