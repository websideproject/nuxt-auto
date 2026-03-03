<template>
  <div class="flex items-center justify-center">
    <UIcon
      v-if="isAllowed"
      name="i-heroicons-check-circle"
      class="text-green-500"
      size="20"
    />
    <UIcon
      v-else
      name="i-heroicons-x-circle"
      class="text-red-500"
      size="20"
    />
  </div>
</template>

<script setup lang="ts">
type Action = 'create' | 'read' | 'update' | 'delete'

interface Props {
  resource: string
  action: Action
}

const props = defineProps<Props>()

const { canCreate, canRead, canUpdate, canDelete } = useResourceActions(props.resource)

const isAllowed = computed(() => {
  switch (props.action) {
    case 'create':
      return canCreate.value
    case 'read':
      return canRead.value
    case 'update':
      return canUpdate.value
    case 'delete':
      return canDelete.value
    default:
      return false
  }
})
</script>
