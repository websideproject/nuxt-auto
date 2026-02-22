<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        Track and analyze your application metrics
      </p>
    </div>

    <!-- Key Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white mt-1">1,234</div>
            <div class="text-sm text-green-600 dark:text-green-400 mt-1">
              <UIcon name="i-heroicons-arrow-trending-up" class="inline h-4 w-4" />
              +12% from last month
            </div>
          </div>
          <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <UIcon name="i-heroicons-user-group" class="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Posts</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white mt-1">567</div>
            <div class="text-sm text-green-600 dark:text-green-400 mt-1">
              <UIcon name="i-heroicons-arrow-trending-up" class="inline h-4 w-4" />
              +8% from last month
            </div>
          </div>
          <div class="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <UIcon name="i-heroicons-document-text" class="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">Page Views</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white mt-1">45.2K</div>
            <div class="text-sm text-green-600 dark:text-green-400 mt-1">
              <UIcon name="i-heroicons-arrow-trending-up" class="inline h-4 w-4" />
              +23% from last month
            </div>
          </div>
          <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
            <UIcon name="i-heroicons-eye" class="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-medium text-gray-600 dark:text-gray-400">Avg. Session</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white mt-1">4m 32s</div>
            <div class="text-sm text-red-600 dark:text-red-400 mt-1">
              <UIcon name="i-heroicons-arrow-trending-down" class="inline h-4 w-4" />
              -5% from last month
            </div>
          </div>
          <div class="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
            <UIcon name="i-heroicons-clock" class="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Traffic Chart -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Traffic Overview</h2>
            <USelectMenu v-model="trafficPeriod" :options="['7d', '30d', '90d', '1y']" />
          </div>
        </template>

        <div class="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div class="text-center">
            <UIcon name="i-heroicons-chart-bar" class="h-12 w-12 mx-auto mb-2" />
            <p>Traffic chart visualization</p>
            <p class="text-sm mt-1">(Chart library integration needed)</p>
          </div>
        </div>
      </UCard>

      <!-- Top Pages -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Top Pages</h2>
        </template>

        <div class="space-y-4">
          <div v-for="page in topPages" :key="page.path" class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ page.path }}</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">{{ page.views }} views</div>
            </div>
            <div class="ml-4 flex-shrink-0">
              <div class="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  class="bg-primary-500 h-2 rounded-full"
                  :style="{ width: `${page.percentage}%` }"
                />
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Recent Activity -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
      </template>

      <div class="space-y-4">
        <div v-for="activity in recentActivity" :key="activity.id" class="flex items-start gap-3">
          <div class="p-2 rounded-lg" :class="activity.colorClass">
            <UIcon :name="activity.icon" class="h-5 w-5" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900 dark:text-white">{{ activity.title }}</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">{{ activity.description }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">{{ activity.time }}</div>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  layout: 'admin',
})

const trafficPeriod = ref('30d')

const topPages = [
  { path: '/blog/getting-started', views: 12543, percentage: 100 },
  { path: '/docs/introduction', views: 8234, percentage: 65 },
  { path: '/about', views: 5432, percentage: 43 },
  { path: '/pricing', views: 3456, percentage: 28 },
  { path: '/contact', views: 2345, percentage: 19 },
]

const recentActivity = [
  {
    id: 1,
    title: 'New user registered',
    description: 'john@example.com joined the platform',
    time: '5 minutes ago',
    icon: 'i-heroicons-user-plus',
    colorClass: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  },
  {
    id: 2,
    title: 'New post published',
    description: 'Getting Started with Nuxt 4 was published',
    time: '15 minutes ago',
    icon: 'i-heroicons-document-plus',
    colorClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
  {
    id: 3,
    title: 'Comment posted',
    description: 'New comment on "Introduction to Auto API"',
    time: '1 hour ago',
    icon: 'i-heroicons-chat-bubble-left',
    colorClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  },
  {
    id: 4,
    title: 'Settings updated',
    description: 'Site settings were modified',
    time: '2 hours ago',
    icon: 'i-heroicons-cog-6-tooth',
    colorClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  },
]
</script>
