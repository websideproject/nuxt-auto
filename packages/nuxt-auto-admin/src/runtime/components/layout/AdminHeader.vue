<template>
  <header class="h-14 bg-white dark:bg-gray-900 border-b border-gray-200/60 dark:border-gray-800/60 px-4 sm:px-6 flex-shrink-0">
    <div class="h-full flex items-center justify-between">
      <!-- Breadcrumbs -->
      <nav class="flex items-center gap-1.5 text-sm min-w-0 flex-1">
        <NuxtLink
          :to="adminPrefix"
          class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
        >
          <UIcon name="i-heroicons-home" class="h-4 w-4" />
        </NuxtLink>
        <template v-if="breadcrumbs.length > 0">
          <UIcon name="i-heroicons-chevron-right" class="h-3.5 w-3.5 text-gray-400 dark:text-gray-600 flex-shrink-0" />
          <template v-for="(crumb, index) in breadcrumbs" :key="index">
            <NuxtLink
              v-if="crumb.to"
              :to="crumb.to"
              class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors truncate"
            >
              {{ crumb.label }}
            </NuxtLink>
            <span v-else class="text-gray-900 dark:text-white font-medium truncate">{{ crumb.label }}</span>
            <UIcon
              v-if="index < breadcrumbs.length - 1"
              name="i-heroicons-chevron-right"
              class="h-3.5 w-3.5 text-gray-400 dark:text-gray-600 flex-shrink-0"
            />
          </template>
        </template>
      </nav>

      <!-- Right side actions -->
      <div class="flex items-center gap-2 ml-4">
        <UColorModeButton />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const config = useRuntimeConfig()
const adminPrefix = config.public.autoAdmin?.prefix || '/admin'
const route = useRoute()

const breadcrumbs = computed(() => {
  const crumbs: Array<{ label: string; to?: string }> = []

  // Parse path segments
  const pathSegments = route.path
    .replace(adminPrefix, '')
    .split('/')
    .filter(Boolean)

  if (pathSegments.length === 0) return crumbs

  // Resource name (first segment)
  const resourceName = pathSegments[0]
  crumbs.push({
    label: formatResourceName(resourceName),
    to: pathSegments.length === 1 ? undefined : `${adminPrefix}/${resourceName}`,
  })

  // ID or action (second segment)
  if (pathSegments.length > 1) {
    const segment = pathSegments[1]
    if (segment === 'new') {
      crumbs.push({ label: 'Create' })
    } else if (pathSegments.length === 2) {
      crumbs.push({ label: `#${segment}` })
    } else {
      // Has ID and action (edit, etc)
      crumbs.push({
        label: `#${segment}`,
        to: `${adminPrefix}/${resourceName}/${segment}`,
      })
    }
  }

  // Action (third segment - edit, etc)
  if (pathSegments.length > 2) {
    const action = pathSegments[2]
    crumbs.push({ label: formatAction(action) })
  }

  return crumbs
})

function formatResourceName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

function formatAction(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1)
}
</script>
