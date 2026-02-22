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
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
    ]"
  >
    <UIcon :name="page.icon" class="h-4 w-4 flex-shrink-0" />
    <span>{{ page.label }}</span>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { NuxtLink } from '#components'
import type { CustomPageConfig } from '../../types'

const props = defineProps<{
  page: CustomPageConfig
  adminPrefix: string
}>()

const route = useRoute()
const hasAccess = ref(true)
const isCheckingAccess = ref(false)

const { permissions: permissionConfig } = useAdminConfig()
const sidebarBehavior = computed(() => permissionConfig.unauthorizedSidebarItems || 'hide')

// Check custom page permissions
onMounted(async () => {
  if (props.page.canAccess) {
    isCheckingAccess.value = true
    try {
      // TODO: Get actual user from auth context
      hasAccess.value = await props.page.canAccess(null)
    } catch (error) {
      console.error('Error checking custom page access:', error)
      hasAccess.value = false
    } finally {
      isCheckingAccess.value = false
    }
  }
  // TODO: Implement props.page.permissions string/array checking
})

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
  return route.path === fullPath.value || route.path.startsWith(`${fullPath.value}/`)
})
</script>
