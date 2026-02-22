<template>
  <div class="container mx-auto py-8 px-4 max-w-6xl">
    <div class="mb-6">
      <UButton
        to="/demo"
        icon="i-heroicons-arrow-left"
        variant="ghost"
        color="gray"
        class="mb-4"
      >
        Back to Demo Home
      </UButton>

      <h1 class="text-4xl font-bold mb-2">
        Aggregations
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Count, sum, avg, min, max with groupBy and having clauses for powerful data analysis.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="Aggregation queries let you analyze your data without fetching all records. Use groupBy to segment results and having to filter groups."
    />

    <div class="space-y-8">
      <!-- Simple Aggregations Stats -->
      <div>
        <h2 class="text-2xl font-semibold mb-4">Simple Aggregations</h2>

        <div v-if="totalCountLoading || publishedCountLoading || draftCountLoading" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <USkeleton class="h-32" />
          <USkeleton class="h-32" />
          <USkeleton class="h-32" />
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UCard>
            <div class="text-center">
              <p class="text-4xl font-bold text-green-600">{{ totalCount?._count || 0 }}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">Total Posts</p>
              <code class="text-xs text-gray-500">GET /api/posts/aggregate?aggregate=count</code>
            </div>
          </UCard>

          <UCard>
            <div class="text-center">
              <p class="text-4xl font-bold text-blue-600">{{ publishedCount?._count || 0 }}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">Published Posts</p>
              <code class="text-xs text-gray-500">?aggregate=count&filter={published:true}</code>
            </div>
          </UCard>

          <UCard>
            <div class="text-center">
              <p class="text-4xl font-bold text-orange-600">{{ draftCount?._count || 0 }}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">Draft Posts</p>
              <code class="text-xs text-gray-500">?aggregate=count&filter={published:false}</code>
            </div>
          </UCard>
        </div>
      </div>

      <!-- GroupBy Example -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">GroupBy Example</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            GET <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">/api/posts/aggregate?aggregate=count&groupBy=published</code>
          </p>
        </template>

        <div v-if="groupByLoading">
          <USkeleton class="h-64" />
        </div>

        <div v-else-if="groupByError" class="text-red-600">
          Error: {{ groupByError }}
        </div>

        <div v-else class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Group posts by published status and count each group:
          </p>

          <AggregationChart :data="groupByChartData" />

          <div class="mt-4">
            <p class="text-sm font-medium mb-2">Raw Data:</p>
            <ApiResponse :data="groupByData" />
          </div>
        </div>
      </UCard>

      <!-- GroupBy User Example -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Posts Per User</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            GET <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">/api/posts/aggregate?aggregate=count&groupBy=userId</code>
          </p>
        </template>

        <div v-if="userGroupLoading">
          <USkeleton class="h-64" />
        </div>

        <div v-else-if="userGroupError" class="text-red-600">
          Error: {{ userGroupError }}
        </div>

        <div v-else class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Count posts grouped by user:
          </p>

          <AggregationChart :data="userGroupChartData" />

          <div class="mt-4">
            <p class="text-sm font-medium mb-2">Raw Data:</p>
            <ApiResponse :data="userGroupData" />
          </div>
        </div>
      </UCard>

      <!-- Interactive Builder -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Interactive Aggregation Builder</h2>
        </template>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Aggregation Function</label>
            <div class="flex gap-2">
              <UButton
                v-for="func in ['count', 'sum', 'avg', 'min', 'max']"
                :key="func"
                :variant="builderAggregate === func ? 'solid' : 'outline'"
                :color="builderAggregate === func ? 'green' : 'gray'"
                size="sm"
                @click="builderAggregate = func"
              >
                {{ func }}
              </UButton>
            </div>
          </div>

          <div v-if="builderAggregate !== 'count'">
            <label class="block text-sm font-medium mb-2">Field (required for {{ builderAggregate }})</label>
            <div class="flex gap-2">
              <UButton
                v-for="field in ['id', 'userId']"
                :key="field"
                :variant="builderField === field ? 'solid' : 'outline'"
                :color="builderField === field ? 'blue' : 'gray'"
                size="sm"
                @click="builderField = field"
              >
                {{ field }}
              </UButton>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Group By (optional)</label>
            <div class="flex gap-2">
              <UButton
                :variant="builderGroupBy === 'published' ? 'solid' : 'outline'"
                :color="builderGroupBy === 'published' ? 'green' : 'gray'"
                size="sm"
                @click="builderGroupBy = builderGroupBy === 'published' ? null : 'published'"
              >
                Published
              </UButton>
              <UButton
                :variant="builderGroupBy === 'userId' ? 'solid' : 'outline'"
                :color="builderGroupBy === 'userId' ? 'green' : 'gray'"
                size="sm"
                @click="builderGroupBy = builderGroupBy === 'userId' ? null : 'userId'"
              >
                User ID
              </UButton>
            </div>
          </div>

          <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p class="text-sm font-medium mb-2">Generated Query:</p>
            <code class="text-sm">{{ builderQuery }}</code>
          </div>

          <UButton
            @click="executeBuilderQuery"
            :loading="builderLoading"
            icon="i-heroicons-play"
            color="green"
          >
            Execute Query
          </UButton>

          <div v-if="builderResult">
            <p class="text-sm font-medium mb-2">Result:</p>

            <AggregationChart
              v-if="builderGroupBy && Array.isArray(builderResult)"
              :data="formatBuilderChartData"
              class="mb-4"
            />

            <ApiResponse :data="builderResult" />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
// Simple aggregations
const { data: totalCount, isLoading: totalCountLoading } = useAutoApiAggregate('posts', {
  aggregate: 'count'
})

const { data: publishedCount, isLoading: publishedCountLoading } = useAutoApiAggregate('posts', {
  aggregate: 'count',
  filter: { published: true }
})

const { data: draftCount, isLoading: draftCountLoading } = useAutoApiAggregate('posts', {
  aggregate: 'count',
  filter: { published: false }
})

// GroupBy published
const {
  data: groupByData,
  isLoading: groupByLoading,
  error: groupByError
} = useAutoApiAggregate('posts', {
  aggregate: 'count',
  groupBy: 'published'
})

const groupByChartData = computed(() => {
  if (!groupByData.value || !Array.isArray(groupByData.value)) return []

  return groupByData.value.map((item: any) => ({
    label: item.published ? 'Published' : 'Draft',
    value: item._count
  }))
})

// GroupBy userId
const {
  data: userGroupData,
  isLoading: userGroupLoading,
  error: userGroupError
} = useAutoApiAggregate('posts', {
  aggregate: 'count',
  groupBy: 'userId'
})

const userGroupChartData = computed(() => {
  if (!userGroupData.value || !Array.isArray(userGroupData.value)) return []

  return userGroupData.value.map((item: any) => ({
    label: `User ${item.userId}`,
    value: item._count
  }))
})

// Interactive Builder
const builderAggregate = ref('count')
const builderField = ref<string | null>('id')
const builderGroupBy = ref<string | null>(null)
const builderResult = ref<any>(null)
const builderLoading = ref(false)

const builderQuery = computed(() => {
  let agg = builderAggregate.value

  // For sum/avg/min/max, include field in function syntax
  if (agg !== 'count' && builderField.value) {
    agg = `${agg}(${builderField.value})`
  }

  let query = `/api/posts/aggregate?aggregate=${agg}`
  if (builderGroupBy.value) {
    query += `&groupBy=${builderGroupBy.value}`
  }
  return query
})

const formatBuilderChartData = computed(() => {
  if (!builderResult.value || !Array.isArray(builderResult.value)) return []

  return builderResult.value.map((item: any) => {
    let label = 'Result'

    if (builderGroupBy.value === 'published') {
      label = item.group?.published !== undefined ? (item.group.published ? 'Published' : 'Draft') : 'Unknown'
    } else if (builderGroupBy.value === 'userId') {
      label = `User ${item.group?.userId || item.userId || '?'}`
    }

    // Handle different aggregate result keys
    let value = 0
    if (builderAggregate.value === 'count') {
      value = item.count || item._count || 0
    } else if (builderField.value) {
      // For sum/avg/min/max, look for keys like sum_id, avg_userId, etc.
      const key = `${builderAggregate.value}_${builderField.value}`
      value = item[key] || 0
    }

    return {
      label,
      value
    }
  })
})

const executeBuilderQuery = async () => {
  builderLoading.value = true

  try {
    let agg = builderAggregate.value

    // For sum/avg/min/max, include field in function syntax
    if (agg !== 'count' && builderField.value) {
      agg = `${agg}(${builderField.value})`
    }

    const params: any = { aggregate: agg }
    if (builderGroupBy.value) {
      params.groupBy = builderGroupBy.value
    }

    const urlParams = new URLSearchParams(params)
    const result = await $fetch(`/api/posts/aggregate?${urlParams.toString()}`)
    builderResult.value = result
  } catch (err) {
    console.error('Failed to execute query:', err)
  } finally {
    builderLoading.value = false
  }
}
</script>
