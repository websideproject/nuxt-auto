<template>
  <div class="space-y-8">
    <!-- Welcome Header -->
    <div>
      <h1 class="text-2xl font-semibold text-highlighted">
        Dashboard
      </h1>
      <p class="mt-1 text-sm text-muted">
        Manage your application resources
      </p>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <UCard class="border-default/60">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <UIcon
              name="i-heroicons-cube"
              class="h-5 w-5 text-primary-600 dark:text-primary-400"
            />
          </div>
          <div>
            <div class="text-2xl font-semibold text-highlighted">
              {{ resources.length }}
            </div>
            <div class="text-xs text-muted">
              Total Resources
            </div>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/60">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <UIcon
              name="i-heroicons-check-circle"
              class="h-5 w-5 text-green-600 dark:text-green-400"
            />
          </div>
          <div>
            <div class="text-2xl font-semibold text-highlighted">
              Ready
            </div>
            <div class="text-xs text-muted">
              System Status
            </div>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/60">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <UIcon
              name="i-heroicons-sparkles"
              class="h-5 w-5 text-blue-600 dark:text-blue-400"
            />
          </div>
          <div>
            <div class="text-2xl font-semibold text-highlighted">
              Auto
            </div>
            <div class="text-xs text-muted">
              Generated UI
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Resources Grid -->
    <div>
      <h2 class="text-base font-semibold text-highlighted mb-3">
        Resources
      </h2>

      <div
        v-if="isLoading"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        <USkeleton
          v-for="i in 6"
          :key="i"
          class="h-24"
        />
      </div>

      <div
        v-else-if="resources.length > 0"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        <UCard
          v-for="resource in resources"
          :key="resource.name"
          class="border-default/60 hover:border-accented transition-colors cursor-pointer group"
          @click="goToResource(resource.name)"
        >
          <div class="flex items-center gap-3">
            <div class="p-2 bg-elevated rounded-md group-hover:bg-accented transition-colors">
              <UIcon
                :name="resource.icon"
                class="h-4 w-4 text-default"
              />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-medium text-highlighted">
                {{ resource.displayName }}
              </h3>
              <p class="text-xs text-muted mt-0.5">
                Manage {{ resource.displayName.toLowerCase() }}
              </p>
            </div>
            <UIcon
              name="i-heroicons-chevron-right"
              class="h-4 w-4 text-dimmed flex-shrink-0"
            />
          </div>
        </UCard>
      </div>

      <UCard
        v-else
        class="border-default/60"
      >
        <div class="text-center py-8">
          <UIcon
            name="i-heroicons-inbox"
            class="h-10 w-10 text-dimmed mx-auto mb-2"
          />
          <p class="text-sm text-muted">
            No resources available
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRuntimeConfig } from '#app'
import { useAdminRegistry } from '../../composables/useAdminRegistry'
import { useJunctionTables } from '../../composables/useM2MDetection'

defineOptions({ name: 'AdminDashboardPage' })

const router = useRouter()
const config = useRuntimeConfig()
const adminPrefix = config.public.autoAdmin?.prefix || '/admin'

const { allResources, isLoading } = useAdminRegistry()
// As in the sidebar: junction tables are edited through their M2M cards, not listed as resources
const { isJunction } = useJunctionTables()
const resources = computed(() => allResources.value.filter(r => !isJunction(r)))

function goToResource(resourceName: string) {
  router.push(`${adminPrefix}/${resourceName}`)
}
</script>
