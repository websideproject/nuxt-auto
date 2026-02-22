<template>
  <aside class="w-64 h-screen bg-white dark:bg-gray-900 border-r border-gray-200/60 dark:border-gray-800/60 flex flex-col flex-shrink-0">
    <!-- Logo/Branding -->
    <div class="h-14 px-4 py-5 border-b border-gray-200/60 dark:border-gray-800/60 flex-shrink-0">
      <NuxtLink :to="adminPrefix" class="flex items-center gap-2.5 group">
        <div v-if="branding.logo" class="flex-shrink-0">
          <img :src="branding.logo" alt="Logo" class="h-7 w-7 rounded-md" />
        </div>
        <div v-else class="flex-shrink-0 h-7 w-7 rounded-md bg-primary-600 dark:bg-primary-500 flex items-center justify-center">
          <UIcon name="i-heroicons-cube" class="h-4 w-4 text-white" />
        </div>
        <span class="font-semibold text-sm text-gray-900 dark:text-white">
          {{ branding.title }}
        </span>
      </NuxtLink>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3 py-4">
      <div v-if="isLoading" class="text-center text-gray-500 dark:text-gray-400 py-8">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin h-5 w-5 mx-auto mb-2" />
        <div class="text-xs">Loading...</div>
      </div>

      <template v-else>
        <!-- Ungrouped items (resources + custom pages) -->
        <div v-if="ungroupedItems.length > 0" class="space-y-1 mb-4">
          <template v-for="item in ungroupedItems" :key="item.name">
            <ResourceNavLink
              v-if="item.type === 'resource'"
              :resource="item"
              :admin-prefix="adminPrefix"
            />
            <CustomPageNavLink
              v-else
              :page="item"
              :admin-prefix="adminPrefix"
            />
          </template>
        </div>

        <!-- Grouped items (resources + custom pages) -->
        <div v-for="(items, group) in groupedItems" :key="group" class="mb-4">
          <div class="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ group }}
          </div>
          <div class="space-y-1 mt-1">
            <template v-for="item in items" :key="item.name">
              <ResourceNavLink
                v-if="item.type === 'resource'"
                :resource="item"
                :admin-prefix="adminPrefix"
              />
              <CustomPageNavLink
                v-else
                :page="item"
                :admin-prefix="adminPrefix"
              />
            </template>
          </div>
        </div>
      </template>
    </nav>

    <!-- Footer -->
    <div class="px-4 py-3 border-t border-gray-200/60 dark:border-gray-800/60 flex-shrink-0">
      <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500">
        <UIcon name="i-heroicons-sparkles" class="h-3.5 w-3.5" />
        <span>Nuxt Auto Admin</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { getJunctionTableNames } from '../../composables/useM2MDetection'

const config = useRuntimeConfig()
const adminPrefix = config.public.autoAdmin?.prefix || '/admin'
const branding = computed(() => config.public.autoAdmin?.branding || { title: 'Admin Panel' })
const customPages = computed(() => config.public.autoAdmin?.customPages || [])

const { permissions: permissionConfig } = useAdminConfig()
const sidebarBehavior = computed(() => permissionConfig.unauthorizedSidebarItems || 'hide')

// Load all resources from registry
const { allResources, getResourcesByGroup, isLoading } = useAdminRegistry()

// Auto-detect junction tables from API
const junctionTables = ref<string[]>([])

onMounted(async () => {
  junctionTables.value = await getJunctionTableNames()
})

// Helper to check if item should be shown based on permission config
function shouldShowItem(hasPermission: boolean): boolean {
  if (hasPermission) return true
  // If no permission, show only if behavior is 'disable' (not 'hide')
  return sidebarBehavior.value === 'disable'
}

// Helper to check if a resource should be filtered as a junction table
function isJunctionResource(resource: any): boolean {
  // Filter if manually marked as junction in config
  if (resource.type === 'junction') {
    return true
  }

  // Filter if auto-detected as junction
  if (junctionTables.value.includes(resource.name)) {
    return true
  }

  return false
}

// Merge resources and custom pages
const ungroupedItems = computed(() => {
  const items: any[] = []

  // Add ungrouped resources (filter out junction tables)
  const ungroupedRes = allResources.value.filter((r) => !r.group && !isJunctionResource(r))
  items.push(...ungroupedRes.map(r => ({ ...r, type: 'resource' })))

  // Add ungrouped custom pages
  const ungroupedPages = customPages.value.filter((p: any) => !p.group)
  items.push(...ungroupedPages.map((p: any) => ({ ...p, type: 'page' })))

  // Sort by order
  return items.sort((a, b) => (a.order || 0) - (b.order || 0))
})

const groupedItems = computed(() => {
  const groups: Record<string, any[]> = {}

  // Add grouped resources (filter out junction tables)
  const resourceGroups = getResourcesByGroup.value
  // Filter out Default group as it's shown separately as ungrouped
  const { Default, ...rest } = resourceGroups

  Object.entries(rest).forEach(([group, resources]) => {
    if (!groups[group]) groups[group] = []
    const filteredResources = (resources as any[]).filter(r => !isJunctionResource(r))
    groups[group].push(...filteredResources.map(r => ({ ...r, type: 'resource' })))
  })

  // Add grouped custom pages
  const groupedPages = customPages.value.filter((p: any) => p.group)
  groupedPages.forEach((page: any) => {
    if (!groups[page.group]) groups[page.group] = []
    groups[page.group].push({ ...page, type: 'page' })
  })

  // Sort items within each group by order
  Object.keys(groups).forEach(group => {
    groups[group].sort((a, b) => (a.order || 0) - (b.order || 0))
  })

  return groups
})
</script>
