<template>
  <component
    :is="shouldRender ? (isDisabled ? 'div' : NuxtLink) : 'div'"
    v-if="shouldRender"
    :to="isDisabled ? undefined : fullPath"
    class="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors"
    :class="[
      isDisabled
        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-60'
        : isActive
          ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white',
    ]"
  >
    <UIcon
      :name="page.icon"
      class="h-4 w-4 flex-shrink-0"
    />
    <span>{{ page.label }}</span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { NuxtLink } from '#components'
import { useAllPermissions } from '@websideproject/nuxt-auto-api/composables'
import type { CustomPageConfig } from '../../types'
import { useAdminConfig } from '../../composables/useAdminConfig'
import { grantsAll } from '../../utils/customPageAccess'

const props = defineProps<{
  page: CustomPageConfig
  adminPrefix: string
}>()

const route = useRoute()
const { permissions: permissionConfig } = useAdminConfig()
const sidebarBehavior = computed(() => permissionConfig.unauthorizedSidebarItems || 'hide')

// `permissions: ['users:update', …]` — checked against the caller's API permissions (all required).
const requiresPermissions = computed(() => props.page.permissions !== undefined)
const { data: allPermissions, isLoading: isCheckingAccess } = useAllPermissions({ enabled: requiresPermissions })
const hasAccess = computed(() => !requiresPermissions.value || grantsAll(allPermissions.value?.permissions, props.page.permissions))

// Build full path (support both relative and absolute paths)
const fullPath = computed(() => {
  if (props.page.path.startsWith('/')) {
    return props.page.path
  }
  return `${props.adminPrefix}/${props.page.path}`
})

// Determine if we should render this item at all
const shouldRender = computed(() => {
  // While checking, show the item
  if (isCheckingAccess.value) return true

  // If has access, always show
  if (hasAccess.value) return true

  // If no access, show only if behavior is 'disable' (not 'hide')
  return sidebarBehavior.value === 'disable'
})

// Determine if the item should be disabled
const isDisabled = computed(() => {
  if (isCheckingAccess.value) return false
  return !hasAccess.value
})

const isActive = computed(() => {
  if (isDisabled.value) return false
  if (!route?.path) return false
  return route.path === fullPath.value || route.path.startsWith(`${fullPath.value}/`)
})
</script>
