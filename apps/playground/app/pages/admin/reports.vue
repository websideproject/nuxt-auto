<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          Generate and download detailed reports about your data
        </p>
      </div>
      <UButton icon="i-heroicons-plus" @click="createReportModalOpen = true">
        Generate New Report
      </UButton>
    </div>

    <!-- Report Types -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <UCard
        v-for="reportType in reportTypes"
        :key="reportType.id"
        class="hover:shadow-lg transition-shadow cursor-pointer"
        @click="selectReportType(reportType)"
      >
        <div class="flex items-start gap-4">
          <div class="p-3 rounded-xl" :class="reportType.colorClass">
            <UIcon :name="reportType.icon" class="h-6 w-6" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-gray-900 dark:text-white">{{ reportType.title }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ reportType.description }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Recent Reports -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Recent Reports</h2>
          <UButton variant="ghost" size="sm">View All</UButton>
        </div>
      </template>

      <div class="divide-y divide-gray-200 dark:divide-gray-800">
        <div
          v-for="report in recentReports"
          :key="report.id"
          class="py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors px-4 -mx-4"
        >
          <div class="flex items-center gap-4 flex-1 min-w-0">
            <div class="p-2 rounded-lg" :class="report.statusColor">
              <UIcon :name="report.statusIcon" class="h-5 w-5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-medium text-gray-900 dark:text-white truncate">{{ report.name }}</h3>
                <UBadge :color="report.typeColor" variant="soft" size="xs">
                  {{ report.type }}
                </UBadge>
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Generated {{ report.generatedAt }} • {{ report.size }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 ml-4">
            <UButton
              v-if="report.status === 'completed'"
              icon="i-heroicons-arrow-down-tray"
              variant="ghost"
              size="sm"
              @click="downloadReport(report)"
            >
              Download
            </UButton>
            <UButton
              v-else-if="report.status === 'processing'"
              icon="i-heroicons-arrow-path"
              variant="ghost"
              size="sm"
              disabled
            >
              Processing...
            </UButton>
            <UDropdownMenu>
              <template #trigger>
                <UButton icon="i-heroicons-ellipsis-vertical" variant="ghost" size="sm" />
              </template>
              <template #items>
                <div>
                  <UButton
                    label="View Details"
                    icon="i-heroicons-eye"
                    variant="ghost"
                    size="sm"
                    block
                  />
                  <UButton
                    label="Delete"
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="sm"
                    block
                  />
                </div>
              </template>
            </UDropdownMenu>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Scheduled Reports -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Scheduled Reports</h2>
          <UButton variant="ghost" size="sm" icon="i-heroicons-plus">Add Schedule</UButton>
        </div>
      </template>

      <div v-if="scheduledReports.length === 0" class="text-center py-8">
        <UIcon name="i-heroicons-calendar" class="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p class="text-gray-600 dark:text-gray-400">No scheduled reports</p>
        <p class="text-sm text-gray-500 dark:text-gray-500 mt-1">
          Create a schedule to automatically generate reports
        </p>
      </div>

      <div v-else class="space-y-4">
        <div v-for="schedule in scheduledReports" :key="schedule.id" class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div class="flex items-center gap-4">
            <UIcon name="i-heroicons-calendar" class="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <div class="font-medium text-gray-900 dark:text-white">{{ schedule.name }}</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">{{ schedule.frequency }}</div>
            </div>
          </div>
          <UToggle v-model="schedule.enabled" />
        </div>
      </div>
    </UCard>

    <!-- Create Report Modal -->
    <UModal v-model:open="createReportModalOpen">
      <template #body>
        <div class="p-6">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Generate New Report</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Report Type
              </label>
              <USelectMenu v-model="newReport.type" :options="reportTypes.map(r => ({ label: r.title, value: r.id }))" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <USelectMenu v-model="newReport.dateRange" :options="['Last 7 days', 'Last 30 days', 'Last 90 days', 'Custom']" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Format
              </label>
              <USelectMenu v-model="newReport.format" :options="['PDF', 'CSV', 'Excel', 'JSON']" />
            </div>
          </div>
        </div>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50">
          <UButton variant="ghost" @click="close">Cancel</UButton>
          <UButton @click="generateReport">Generate Report</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  layout: 'admin',
})

const createReportModalOpen = ref(false)

const reportTypes = [
  {
    id: 'users',
    title: 'User Activity Report',
    description: 'Detailed analysis of user behavior and engagement',
    icon: 'i-heroicons-users',
    colorClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'content',
    title: 'Content Performance',
    description: 'Analytics on posts, views, and interactions',
    icon: 'i-heroicons-document-chart-bar',
    colorClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  },
  {
    id: 'system',
    title: 'System Health Report',
    description: 'Performance metrics and system diagnostics',
    icon: 'i-heroicons-cpu-chip',
    colorClass: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  },
]

const recentReports = [
  {
    id: 1,
    name: 'User Activity - November 2024',
    type: 'User Activity',
    typeColor: 'blue',
    status: 'completed',
    statusIcon: 'i-heroicons-check-circle',
    statusColor: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    generatedAt: '2 hours ago',
    size: '2.4 MB',
  },
  {
    id: 2,
    name: 'Content Performance - Q4 2024',
    type: 'Content',
    typeColor: 'purple',
    status: 'processing',
    statusIcon: 'i-heroicons-arrow-path',
    statusColor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    generatedAt: '10 minutes ago',
    size: 'Processing...',
  },
  {
    id: 3,
    name: 'System Health - Weekly',
    type: 'System',
    typeColor: 'green',
    status: 'completed',
    statusIcon: 'i-heroicons-check-circle',
    statusColor: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    generatedAt: '1 day ago',
    size: '856 KB',
  },
]

const scheduledReports = ref([])

const newReport = ref({
  type: '',
  dateRange: 'Last 30 days',
  format: 'PDF',
})

function selectReportType(reportType: any) {
  newReport.value.type = reportType.id
  createReportModalOpen.value = true
}

function generateReport() {
  // Simulate report generation
  const toast = useToast()
  toast.add({
    title: 'Report generation started',
    description: 'Your report will be ready in a few moments',
    color: 'blue',
  })
  createReportModalOpen.value = false
}

function downloadReport(report: any) {
  // Simulate download
  const toast = useToast()
  toast.add({
    title: 'Download started',
    description: `Downloading ${report.name}`,
    color: 'green',
  })
}
</script>
