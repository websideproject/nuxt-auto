<template>
  <UCard class="border-gray-200/60 dark:border-gray-800/60">
    <!-- Card Header -->
    <template #header>
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ relation.label || formatFieldLabel(relation.name) }}
          </h3>
          <p v-if="relation.help" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {{ relation.help }}
          </p>
        </div>
        <UBadge v-if="hasChanges" color="primary" variant="soft">
          Unsaved changes
        </UBadge>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center p-8">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin h-6 w-6" />
      <span class="ml-2">Loading relations...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-4">
      <div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <UIcon name="i-heroicons-exclamation-circle" class="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 class="font-semibold text-red-900 dark:text-red-200">Error Loading Relations</h3>
          <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ error.message }}</p>
        </div>
      </div>
    </div>

    <!-- Multi Select -->
    <div v-else class="space-y-5">
      <MultiRelationSelect
        v-model="selectedIds"
        :options="relation.options"
        :placeholder="`Select ${relation.label || relation.name}...`"
        :disabled="disabled"
      />

      <!-- Action Buttons -->
      <div class="flex gap-3 pt-1">
        <UButton
          :loading="isPending"
          :disabled="disabled || !hasChanges || isPending"
          @click="saveRelations"
        >
          Save {{ relation.label || relation.name }}
        </UButton>
        <UButton
          v-if="hasChanges"
          variant="ghost"
          :disabled="disabled || isPending"
          @click="resetChanges"
        >
          Reset
        </UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FieldConfig } from '../types'
import { formatFieldLabel } from '../utils/fieldTypeMapping'
import MultiRelationSelect from './widgets/MultiRelationSelect.vue'
// useM2MRelation and useM2MSync are auto-imported from nuxt-auto-api

const props = defineProps<{
  resourceName: string
  resourceId: string | number
  relation: FieldConfig
  disabled?: boolean
}>()

const emit = defineEmits<{
  success: []
}>()

const toast = useToast()

// Get relation resource name
const relationResource = computed(() => props.relation.options?.resource || props.relation.name)

// Query current relations using TanStack Query
const { data: relations, isLoading, error } = useM2MRelation(
  props.resourceName,
  computed(() => props.resourceId),
  relationResource,
  undefined,
  {
    enabled: computed(() => !!props.resourceId),
  }
)

// Local state for editing
const selectedIds = ref<(string | number)[]>([])

// Sync local state with query data
watch(() => relations.value?.ids, (ids) => {
  if (ids) {
    selectedIds.value = [...ids]
  }
}, { immediate: true })

// Track changes
const hasChanges = computed(() => {
  const current = [...selectedIds.value].sort()
  const original = [...(relations.value?.ids || [])].sort()
  return JSON.stringify(current) !== JSON.stringify(original)
})

// Sync mutation with optimistic updates
const { mutate: syncRelations, isPending } = useM2MSync(
  props.resourceName,
  computed(() => props.resourceId),
  relationResource,
  {
    onSuccess: () => {
      toast.add({
        title: 'Success',
        description: `${props.relation.label || props.relation.name} updated successfully`,
        icon: 'i-heroicons-check-circle',
        color: 'success'
      })
      emit('success')
    },
    onError: (error) => {
      toast.add({
        title: 'Error',
        description: error.message || `Failed to update ${props.relation.label || props.relation.name}`,
        icon: 'i-heroicons-exclamation-circle',
        color: 'error'
      })
    }
  }
)

// Save relations
function saveRelations() {
  syncRelations({ ids: selectedIds.value })
}

// Reset changes
function resetChanges() {
  selectedIds.value = [...(relations.value?.ids || [])]
}
</script>
