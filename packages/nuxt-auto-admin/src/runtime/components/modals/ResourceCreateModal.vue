<template>
  <DefineTemplate>
    <ResourceForm
      :resource-name="resourceName"
      mode="create"
      show-cancel
      @success="handleSuccess"
      @cancel="close"
    />
  </DefineTemplate>

  <UModal
    v-if="isDesktop"
    v-model:open="isOpen"
    :title="`Create ${resource?.displayName || resourceName}`"
    :description="`Add a new ${resource?.displayName?.toLowerCase() || resourceName} to your database`"
    :ui="{ content: 'w-full max-w-4xl', body: 'p-0' }"
  >
    <template #body>
      <ReuseTemplate />
    </template>
  </UModal>

  <UDrawer
    v-else
    v-model:open="isOpen"
    :title="`Create ${resource?.displayName || resourceName}`"
    :description="`Add a new ${resource?.displayName?.toLowerCase() || resourceName} to your database`"
    direction="right"
    :ui="{ content: 'w-full max-w-4xl', body: 'p-0' }"
  >
    <template #body>
      <ReuseTemplate />
    </template>
  </UDrawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'

const [DefineTemplate, ReuseTemplate] = createReusableTemplate()

const props = defineProps<{
  resourceName: string
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

function close() {
  emit('update:open', false)
}

function handleSuccess(data: any) {
  emit('success', data)
  close()
}
</script>
