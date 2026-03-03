<template>
  <component
    :is="shouldRender ? (isDisabled ? 'div' : NuxtLink) : 'div'"
    v-if="shouldRender"
    :to="isDisabled ? undefined : `${adminPrefix}/${resource.name}`"
    class="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors"
    :class="[
      isDisabled
        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-60'
        : isActive
          ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
    ]"
  >
    <UIcon :name="resource.icon" class="h-4 w-4 flex-shrink-0" />
    <span>{{ resource.displayName }}</span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { NuxtLink } from '#components'
import type { ResourceSchema } from '../../types'

const props = defineProps<{
  resource: ResourceSchema
  adminPrefix: string
}>()

const route = useRoute()

// Check permissions for this resource
const { hasAnyPermission, isLoading: isLoadingPermissions } = useAdminPermissions(props.resource.name)
const { permissions: permissionConfig } = useAdminConfig()
const sidebarBehavior = computed(() => permissionConfig.unauthorizedSidebarItems || 'hide')

// Determine if we should render this item at all
const shouldRender = computed(() => {
  // While loading, show the item
  if (isLoadingPermissions.value) return true

  // If has permission, always show
  if (hasAnyPermission.value) return true

  // If no permission, show only if behavior is 'disable' (not 'hide')
  return sidebarBehavior.value === 'disable'
})

// Determine if the item should be disabled
const isDisabled = computed(() => {
  if (isLoadingPermissions.value) return false
  return !hasAnyPermission.value
})

const isActive = computed(() => {
  if (isDisabled.value) return false
  return route.path.startsWith(`${props.adminPrefix}/${props.resource.name}`)
})
</script>
