<template>
  <DefineTemplate>
    <ResourceForm
      :resource-name="resourceName"
      :id="id"
      mode="edit"
      show-cancel
      @success="handleSuccess"
      @cancel="close"
    />

    <!-- M2M Relations as additional sections if needed -->
    <div v-if="m2mFields.length > 0" class="px-6 pb-6 space-y-4">
      <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Relationships</h3>
        <div class="space-y-4">
          <M2MRelationCard
            v-for="m2mField in m2mFields"
            :key="m2mField.name"
            :resource-name="resourceName"
            :resource-id="id"
            :relation="m2mField"
          />
        </div>
      </div>
    </div>
  </DefineTemplate>

  <UModal
    v-if="isDesktop"
    v-model:open="isOpen"
    :title="`Edit ${resource?.displayName || resourceName}`"
    :description="`Update record #${id}`"
    :ui="{ content: 'w-full max-w-4xl', body: 'p-0' }"
  >
    <template #body>
      <ReuseTemplate />
    </template>
  </UModal>

  <UDrawer
    v-else
    v-model:open="isOpen"
    :title="`Edit ${resource?.displayName || resourceName}`"
    :description="`Update record #${id}`"
    direction="right"
    :ui="{ content: 'w-full max-w-4xl', body: 'p-0' }"
  >
    <template #body>
      <ReuseTemplate />
    </template>
  </UDrawer>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import M2MRelationCard from '../M2MRelationCard.vue'
import { useM2MDetection } from '../../composables/useM2MDetection'

const [DefineTemplate, ReuseTemplate] = createReusableTemplate()

const props = defineProps<{
  resourceName: string
  id: string | number
  open?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: [data: any]
}>()

const { resource } = useAdminResource(props.resourceName)

const isOpen = computed({
  get: () => props.open ?? false,
  set: (value) => emit('update:open', value),
})

const isDesktop = useMediaQuery('(min-width: 1024px)')

// Auto-detect M2M fields
const { detectM2MFields, mergeM2MFields } = useM2MDetection()
const autoM2MFields = ref<any[]>([])

// Detect M2M fields when modal opens
watch(() => props.open, async (isOpen) => {
  if (isOpen && autoM2MFields.value.length === 0) {
    autoM2MFields.value = await detectM2MFields(props.resourceName)
  }
}, { immediate: true })

// Get M2M fields from resource form fields (manual config)
const manualM2MFields = computed(() => {
  if (!resource.value?.formFields?.edit) return []

  return resource.value.formFields.edit.filter(
    field => field.widget === 'MultiRelationSelect' && field.options?.junctionTable
  )
})

// Merge auto-detected with manual M2M fields
const m2mFields = computed(() => {
  return mergeM2MFields(autoM2MFields.value, manualM2MFields.value)
})

function close() {
  emit('update:open', false)
}

function handleSuccess(data: any) {
  emit('success', data)
  close()
}
</script>
