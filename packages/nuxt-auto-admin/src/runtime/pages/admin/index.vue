<template>
  <div class="space-y-8">
    <!-- Welcome Header -->
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Manage your application resources
      </p>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <UCard class="border-gray-200/60 dark:border-gray-800/60">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <UIcon name="i-heroicons-cube" class="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <div class="text-2xl font-semibold text-gray-900 dark:text-white">{{ resources.length }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Total Resources</div>
          </div>
        </div>
      </UCard>

      <UCard class="border-gray-200/60 dark:border-gray-800/60">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div class="text-2xl font-semibold text-gray-900 dark:text-white">Ready</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">System Status</div>
          </div>
        </div>
      </UCard>

      <UCard class="border-gray-200/60 dark:border-gray-800/60">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <UIcon name="i-heroicons-sparkles" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div class="text-2xl font-semibold text-gray-900 dark:text-white">Auto</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Generated UI</div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Resources Grid -->
    <div>
      <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-3">Resources</h2>

      <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <USkeleton v-for="i in 6" :key="i" class="h-24" />
      </div>

      <div v-else-if="resources.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <UCard
          v-for="resource in resources"
          :key="resource.name"
          class="border-gray-200/60 dark:border-gray-800/60 hover:border-gray-300 dark:hover:border-gray-700 transition-colors cursor-pointer group"
          @click="goToResource(resource.name)"
        >
          <div class="flex items-center gap-3">
            <div class="p-2 bg-gray-100 dark:bg-gray-800 rounded-md group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
              <UIcon :name="resource.icon" class="h-4 w-4 text-gray-700 dark:text-gray-300" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white">
                {{ resource.displayName }}
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Manage {{ resource.displayName.toLowerCase() }}
              </p>
            </div>
            <UIcon name="i-heroicons-chevron-right" class="h-4 w-4 text-gray-400 flex-shrink-0" />
          </div>
        </UCard>
      </div>

      <UCard v-else class="border-gray-200/60 dark:border-gray-800/60">
        <div class="text-center py-8">
          <UIcon name="i-heroicons-inbox" class="h-10 w-10 text-gray-400 mx-auto mb-2" />
          <p class="text-sm text-gray-500 dark:text-gray-400">No resources available</p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

definePageMeta({
  layout: 'admin',
})

const router = useRouter()
const config = useRuntimeConfig()
const adminPrefix = config.public.autoAdmin?.prefix || '/admin'

const { allResources: resources, isLoading } = useAdminRegistry()

function goToResource(resourceName: string) {
  router.push(`${adminPrefix}/${resourceName}`)
}
</script>
