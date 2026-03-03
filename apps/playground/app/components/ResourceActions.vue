<template>
  <div class="flex items-center gap-2">
    <PermissionButton
      v-if="showCreate"
      :resource="resource"
      action="create"
      color="primary"
      icon="i-heroicons-plus"
      size="sm"
      @click="onCreate"
    >
      Create
    </PermissionButton>

    <PermissionButton
      v-if="showEdit && itemId"
      :resource="resource"
      action="update"
      color="primary"
      variant="outline"
      icon="i-heroicons-pencil"
      size="sm"
      @click="onEdit"
    >
      Edit
    </PermissionButton>

    <PermissionButton
      v-if="showDelete && itemId"
      :resource="resource"
      action="delete"
      color="error"
      variant="outline"
      icon="i-heroicons-trash"
      size="sm"
      @click="onDelete"
    >
      Delete
    </PermissionButton>

    <slot />
  </div>
</template>

<script setup lang="ts">
interface Props {
  resource: string
  itemId?: string | number
  showCreate?: boolean
  showEdit?: boolean
  showDelete?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  itemId: undefined,
  showCreate: false,
  showEdit: false,
  showDelete: false,
})

const emit = defineEmits<{
  create: []
  edit: []
  delete: []
}>()

function onCreate() {
  emit('create')
}

function onEdit() {
  emit('edit')
}

function onDelete() {
  emit('delete')
}
</script>
