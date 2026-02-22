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
        Nested Relations
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Enhanced include syntax with field selection, filtering, and pagination for related data.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="Use the enhanced syntax to control exactly what fields are returned, filter relations, paginate nested data, and traverse deep relationship chains."
    />

    <div class="space-y-8">
      <!-- Interactive Query Builder -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Interactive Query Builder</h2>
        </template>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Author Fields to Include</label>
            <div class="grid grid-cols-3 gap-2">
              <UCheckbox v-model="queryBuilder.includeId" label="id" />
              <UCheckbox v-model="queryBuilder.includeTitle" label="name" />
              <UCheckbox v-model="queryBuilder.includeContent" label="email" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Post Filters</label>
            <UCheckbox v-model="queryBuilder.publishedOnly" label="Published only" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Limit</label>
            <UInput
              v-model="queryBuilder.limit"
              type="number"
              min="1"
              max="10"
              placeholder="5"
            />
          </div>

          <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <p class="text-sm font-medium mb-2">Generated Query:</p>
            <code class="text-sm">{{ generatedQuery }}</code>
          </div>

          <UButton
            @click="executeQuery"
            :loading="customQueryLoading"
            icon="i-heroicons-play"
            color="green"
          >
            Run Query
          </UButton>

          <div v-if="customQueryResult">
            <p class="text-sm font-medium mb-2">Result:</p>
            <ApiResponse :data="customQueryResult" />
          </div>

          <div v-if="customQueryError" class="text-red-600">
            Error: {{ customQueryError }}
          </div>
        </div>
      </UCard>

      <!-- Example Gallery -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Example Gallery</h2>
        </template>

        <div class="space-y-6">
          <!-- Field Selection Example -->
          <div>
            <h3 class="font-medium mb-2">Field Selection</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Select only specific fields from the relation:
            </p>
            <CodeBlock
              :code="`GET /api/posts?include=author[id,name,email]`"
              language="http"
            />
            <UButton
              @click="runExample('author[id,name,email]')"
              :loading="example1Loading"
              size="sm"
              variant="outline"
              class="mt-2"
            >
              Try it
            </UButton>
            <ApiResponse v-if="example1Result" :data="example1Result?.data?.slice(0, 2)" class="mt-2" />
          </div>

          <!-- Pagination Example -->
          <div>
            <h3 class="font-medium mb-2">Pagination</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Limit the number of related items returned:
            </p>
            <CodeBlock
              :code="`GET /api/users?include=posts{limit:3}`"
              language="http"
            />
            <UButton
              @click="runExample('posts{limit:3}', 'users')"
              :loading="example2Loading"
              size="sm"
              variant="outline"
              class="mt-2"
            >
              Try it
            </UButton>
            <ApiResponse v-if="example2Result" :data="example2Result?.data?.slice(0, 1)" class="mt-2" />
          </div>

          <!-- Filtering Example -->
          <div>
            <h3 class="font-medium mb-2">Filtering Relations</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Filter related items by specific criteria:
            </p>
            <CodeBlock
              :code="`GET /api/users?include=posts{filter:{published:true}}`"
              language="http"
            />
            <UButton
              @click="runExample('posts{filter:{published:true}}', 'users')"
              :loading="example3Loading"
              size="sm"
              variant="outline"
              class="mt-2"
            >
              Try it
            </UButton>
            <ApiResponse v-if="example3Result" :data="example3Result?.data?.slice(0, 1)" class="mt-2" />
          </div>

          <!-- Combined Example -->
          <div>
            <h3 class="font-medium mb-2">Combined: Fields + Filtering + Limit</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Combine all features for precise control:
            </p>
            <CodeBlock
              :code="`GET /api/users?include=posts[id,title]{limit:2,filter:{published:true}}`"
              language="http"
            />
            <UButton
              @click="runExample('posts[id,title]{limit:2,filter:{published:true}}', 'users')"
              :loading="example4Loading"
              size="sm"
              variant="outline"
              class="mt-2"
            >
              Try it
            </UButton>
            <ApiResponse v-if="example4Result" :data="example4Result?.data?.slice(0, 1)" class="mt-2" />
          </div>

          <!-- Deep Nesting Example -->
          <div>
            <h3 class="font-medium mb-2">Deep Nesting</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Traverse multiple levels of relationships:
            </p>
            <CodeBlock
              :code="`GET /api/posts?include=comments.author[name,email]`"
              language="http"
            />
            <UButton
              @click="runExample('comments.author[name,email]')"
              :loading="example5Loading"
              size="sm"
              variant="outline"
              class="mt-2"
            >
              Try it
            </UButton>
            <ApiResponse v-if="example5Result" :data="example5Result?.data?.slice(0, 1)" class="mt-2" />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const queryBuilder = reactive({
  includeId: true,
  includeTitle: true,
  includeContent: false,
  publishedOnly: false,
  limit: '5'
})

const customQueryParams = ref<any>(null)
const customQueryResult = ref(null)
const customQueryError = ref(null)

// Use TanStack Query for the custom query
const { data: customData, isLoading: customQueryLoading, error: customError } = useAutoApiList('posts',
  computed(() => customQueryParams.value),
  {
    enabled: computed(() => customQueryParams.value !== null),
  }
)

// Watch for data changes and update result
watch(customData, (newData) => {
  if (newData) {
    customQueryResult.value = newData
  }
})

watch(customError, (newError) => {
  if (newError) {
    customQueryError.value = (newError as any).message || 'Failed to fetch'
  }
})

const example1Result = ref(null)
const example1Loading = ref(false)
const example2Result = ref(null)
const example2Loading = ref(false)
const example3Result = ref(null)
const example3Loading = ref(false)
const example4Result = ref(null)
const example4Loading = ref(false)
const example5Result = ref(null)
const example5Loading = ref(false)

const generatedQuery = computed(() => {
  let query = '/api/posts?'
  const params = []

  // Build include parameter with field selection
  let includeValue = 'author'
  const authorFields = []
  if (queryBuilder.includeId) authorFields.push('id')
  if (queryBuilder.includeTitle) authorFields.push('name')
  if (queryBuilder.includeContent) authorFields.push('email')

  if (authorFields.length > 0 && authorFields.length < 3) {
    includeValue += `[${authorFields.join(',')}]`
  }

  params.push(`include=${includeValue}`)

  // Add root resource filters/limit
  if (queryBuilder.limit) params.push(`limit=${queryBuilder.limit}`)
  if (queryBuilder.publishedOnly) {
    // Show URL-encoded version in the display
    params.push(`filter=${encodeURIComponent(JSON.stringify({ published: true }))}`)
  }

  return query + params.join('&')
})

const executeQuery = () => {
  customQueryError.value = null
  customQueryResult.value = null

  // Build enhanced include syntax
  let includeValue = 'author'

  // Add field selection for author
  const authorFields = []
  if (queryBuilder.includeId) authorFields.push('id')
  if (queryBuilder.includeTitle) authorFields.push('name') // author.name instead of title
  if (queryBuilder.includeContent) authorFields.push('email') // author.email instead of content

  if (authorFields.length > 0 && authorFields.length < 3) {
    includeValue += `[${authorFields.join(',')}]`
  }

  const params: any = { include: includeValue }

  // Add limit for posts (root resource)
  if (queryBuilder.limit) {
    params.limit = queryBuilder.limit
  }

  // Add filter for posts (root resource)
  if (queryBuilder.publishedOnly) {
    params.filter = { published: true }
  }

  // Update params to trigger TanStack Query refetch
  customQueryParams.value = params
}

const runExample = async (includeValue: string, resource = 'posts') => {
  const loadingKey = includeValue.includes('author[id,name,email]') ? 'example1Loading' :
    includeValue.includes('posts{limit:3}') ? 'example2Loading' :
    includeValue.includes('posts{filter:{published:true}}') && !includeValue.includes('[') ? 'example3Loading' :
    includeValue.includes('posts[id,title]') ? 'example4Loading' : 'example5Loading'

  const resultKey = includeValue.includes('author[id,name,email]') ? 'example1Result' :
    includeValue.includes('posts{limit:3}') ? 'example2Result' :
    includeValue.includes('posts{filter:{published:true}}') && !includeValue.includes('[') ? 'example3Result' :
    includeValue.includes('posts[id,title]') ? 'example4Result' : 'example5Result'

  eval(`${loadingKey}.value = true`)

  try {
    const result = await $fetch(`/api/${resource}?include=${includeValue}`)
    eval(`${resultKey}.value = result`)
  } catch (err) {
    console.error('Failed to fetch example:', err)
  } finally {
    eval(`${loadingKey}.value = false`)
  }
}
</script>
