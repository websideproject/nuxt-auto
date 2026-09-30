<template>
  <div class="space-y-4">
    <div
      v-for="(item, index) in data"
      :key="index"
      class="space-y-2"
    >
      <div class="flex items-center justify-between text-sm">
        <span class="font-medium text-neutral-700 dark:text-neutral-300">
          {{ formatLabel(item.label) }}
        </span>
        <span class="font-semibold text-neutral-900 dark:text-neutral-100">
          {{ formatValue(item.value) }}
        </span>
      </div>
      <div class="relative h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          class="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500"
          :style="{ width: getBarWidth(item.value) + '%' }"
        />
      </div>
    </div>
    <div
      v-if="data.length === 0"
      class="text-center py-8 text-neutral-500"
    >
      No data to display
    </div>
  </div>
</template>

<script setup lang="ts">
interface ChartData {
  label: string
  value: number
}

const props = defineProps<{
  data: ChartData[]
}>()

const maxValue = computed(() => {
  return Math.max(...props.data.map(item => item.value), 1)
})

const getBarWidth = (value: number) => {
  return (value / maxValue.value) * 100
}

const formatLabel = (label: string) => {
  // Convert snake_case or camelCase to Title Case
  return label
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim()
}

const formatValue = (value: number) => {
  // Format large numbers with commas
  return value.toLocaleString()
}
</script>
