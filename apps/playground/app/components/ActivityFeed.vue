<template>
  <div class="space-y-3 max-h-96 overflow-y-auto">
    <div
      v-for="(event, index) in events"
      :key="index"
      class="flex items-start gap-3 p-3 rounded-lg transition-colors"
      :class="getEventClass(event.type)"
    >
      <div class="flex-shrink-0 mt-0.5">
        <UIcon
          :name="getEventIcon(event.type)"
          class="w-5 h-5"
          :class="getIconClass(event.type)"
        />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium text-sm" :class="getTextClass(event.type)">
            {{ event.hook }}
          </span>
          <span class="text-xs text-gray-500">
            {{ formatTime(event.timestamp) }}
          </span>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {{ event.message }}
        </p>
      </div>
    </div>
    <div v-if="events.length === 0" class="text-center py-8 text-gray-500">
      No events yet. Perform an action to see hook activity.
    </div>
  </div>
</template>

<script setup lang="ts">
interface ActivityEvent {
  hook: string
  message: string
  type: 'before' | 'after' | 'error'
  timestamp: Date
}

const props = defineProps<{
  events: ActivityEvent[]
}>()

const getEventClass = (type: string) => {
  switch (type) {
    case 'before':
      return 'bg-blue-50 dark:bg-blue-950'
    case 'after':
      return 'bg-green-50 dark:bg-green-950'
    case 'error':
      return 'bg-red-50 dark:bg-red-950'
    default:
      return 'bg-gray-50 dark:bg-gray-900'
  }
}

const getEventIcon = (type: string) => {
  switch (type) {
    case 'before':
      return 'i-heroicons-arrow-right-circle'
    case 'after':
      return 'i-heroicons-check-circle'
    case 'error':
      return 'i-heroicons-exclamation-circle'
    default:
      return 'i-heroicons-information-circle'
  }
}

const getIconClass = (type: string) => {
  switch (type) {
    case 'before':
      return 'text-blue-500'
    case 'after':
      return 'text-green-500'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
}

const getTextClass = (type: string) => {
  switch (type) {
    case 'before':
      return 'text-blue-700 dark:text-blue-300'
    case 'after':
      return 'text-green-700 dark:text-green-300'
    case 'error':
      return 'text-red-700 dark:text-red-300'
    default:
      return 'text-gray-700 dark:text-gray-300'
  }
}

const formatTime = (timestamp: Date) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>
