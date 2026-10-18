<template>
  <div class="container mx-auto py-8 px-4 max-w-6xl">
    <div class="mb-6">
      <UButton
        to="/demo"
        icon="i-heroicons-arrow-left"
        variant="ghost"
        color="neutral"
        class="mb-4"
      >
        Back to Demo Home
      </UButton>

      <h1 class="text-4xl font-bold mb-2">
        Lifecycle Hooks
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400">
        Before/after CRUD hooks for audit logging, validation, and side effects.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="The posts resource has real server hooks (modules/base/hooks.ts). Every create, update, delete and list below runs them on the server, and the feed shows what they recorded — the same happens when posts change in the admin."
    />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Activity Feed (left column on large screens) -->
      <div class="lg:col-span-1">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">
                Hook Activity Feed
              </h2>
              <UButton
                icon="i-heroicons-trash"
                size="xs"
                variant="ghost"
                color="neutral"
                @click="clearActivity"
              >
                Clear
              </UButton>
            </div>
          </template>

          <ActivityFeed :events="activityFeed" />
        </UCard>
      </div>

      <!-- Interactive Demos (right columns) -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Create Demo -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">
              Create Hook Demo
            </h3>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              beforeCreate tidies the title: trims it, collapses spaces, capitalizes the first letter
            </p>
          </template>

          <div class="space-y-4">
            <UInput
              v-model="createTitle"
              placeholder="Enter post title (try lowercase)"
              size="md"
            />

            <UButton
              :loading="createMutation.isPending.value"
              icon="i-heroicons-plus"
              color="success"
              @click="handleCreate"
            >
              Create Post
            </UButton>

            <div
              v-if="createdPost"
              class="bg-green-50 dark:bg-green-950 p-4 rounded-lg"
            >
              <p class="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                ✓ Post created successfully!
              </p>
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                Sent: <code>{{ sentTitle }}</code>
              </p>
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                Transformed: <code class="font-bold">{{ createdPost.data.title }}</code>
              </p>
            </div>
          </div>
        </UCard>

        <!-- Update Demo -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">
              Update Hook Demo
            </h3>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              beforeUpdate sees the changed fields, afterUpdate the saved post
            </p>
          </template>

          <div class="space-y-4">
            <div v-if="postsLoading">
              <USkeleton class="h-20" />
            </div>

            <div v-else>
              <label class="block text-sm font-medium mb-2">Select a post to update:</label>
              <select
                v-model="selectedPostId"
                class="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
              >
                <option :value="null">
                  -- Select a post --
                </option>
                <option
                  v-for="post in posts?.data?.slice(0, 5)"
                  :key="post.id"
                  :value="post.id"
                >
                  {{ post.title }}
                </option>
              </select>

              <UInput
                v-if="selectedPostId"
                v-model="updateTitle"
                placeholder="New title"
                size="md"
                class="mt-3"
              />

              <UButton
                v-if="selectedPostId"
                :loading="updateMutation.isPending.value"
                icon="i-heroicons-pencil"
                color="success"
                class="mt-3"
                @click="handleUpdate"
              >
                Update Post
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Delete Demo -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">
              Delete Hook Demo
            </h3>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              beforeDelete runs once the authorization rules passed — throwing there would cancel the delete
            </p>
          </template>

          <div class="space-y-4">
            <div v-if="postsLoading">
              <USkeleton class="h-20" />
            </div>

            <div v-else>
              <label class="block text-sm font-medium mb-2">Select a post to delete:</label>
              <select
                v-model="selectedDeleteId"
                class="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
              >
                <option :value="null">
                  -- Select a post --
                </option>
                <option
                  v-for="post in posts?.data?.slice(0, 5)"
                  :key="post.id"
                  :value="post.id"
                >
                  {{ post.title }}
                </option>
              </select>

              <UButton
                v-if="selectedDeleteId"
                :loading="deleteMutation.isPending.value"
                icon="i-heroicons-trash"
                color="error"
                class="mt-3"
                @click="handleDelete"
              >
                Delete Post
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- List Demo -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">
              List Hook Demo
            </h3>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              afterList receives the page of posts
            </p>
          </template>

          <div class="space-y-4">
            <UButton
              :loading="postsLoading"
              icon="i-heroicons-list-bullet"
              color="success"
              @click="handleList"
            >
              Fetch Posts
            </UButton>

            <div
              v-if="listResult"
              class="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg"
            >
              <p class="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                ✓ Fetched {{ listResult.data?.length || 0 }} posts
              </p>
            </div>
          </div>
        </UCard>

        <!-- Execution Order Diagram -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">
              Hook Execution Order
            </h3>
          </template>

          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-sm">
                1
              </div>
              <div class="flex-1">
                <p class="font-medium text-sm">
                  beforeCreate / beforeUpdate / beforeDelete
                </p>
                <p class="text-xs text-neutral-500">
                  Validate, transform, or reject the operation
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3 ml-4">
              <div class="w-0.5 h-8 bg-neutral-300 dark:bg-neutral-700" />
            </div>

            <div class="flex items-center gap-3">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-700 dark:text-neutral-300 font-semibold text-sm">
                2
              </div>
              <div class="flex-1">
                <p class="font-medium text-sm">
                  Database Operation
                </p>
                <p class="text-xs text-neutral-500">
                  Execute the actual query
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3 ml-4">
              <div class="w-0.5 h-8 bg-neutral-300 dark:bg-neutral-700" />
            </div>

            <div class="flex items-center gap-3">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-700 dark:text-green-300 font-semibold text-sm">
                3
              </div>
              <div class="flex-1">
                <p class="font-medium text-sm">
                  afterCreate / afterUpdate / afterDelete
                </p>
                <p class="text-xs text-neutral-500">
                  Log, notify, or trigger side effects
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>
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

// What the server hooks recorded (GET /api/demo/hook-log), plus requests the API refused
const serverLog = ref<ActivityEvent[]>([])
const refusals = ref<ActivityEvent[]>([])
const activityFeed = computed(() => [...refusals.value, ...serverLog.value]
  .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  .slice(0, 30))

async function loadLog() {
  const res = await $fetch<{ data: Array<Omit<ActivityEvent, 'timestamp'> & { timestamp: string, user: string }> }>('/api/demo/hook-log')
  serverLog.value = res.data.map(e => ({ ...e, message: `${e.message} (${e.user})`, timestamp: new Date(e.timestamp) }))
}

function refused(hook: string, err: { message?: string }) {
  refusals.value.unshift({ hook, message: err.message || 'Request refused', type: 'error', timestamp: new Date() })
}

const clearActivity = async () => {
  await $fetch('/api/demo/hook-log', { method: 'DELETE' })
  refusals.value = []
  serverLog.value = []
}

// Changes made elsewhere (the admin, another tab) show up too
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  loadLog()
  timer = setInterval(loadLog, 3000)
})
onBeforeUnmount(() => clearInterval(timer))

// Fetch posts
const { data: posts, isLoading: postsLoading, refetch } = useAutoApiList('posts', {})
const reload = async () => {
  await refetch()
  await loadLog()
}

// Create Demo
const createTitle = ref('')
const sentTitle = ref('')
const createdPost = ref<{ data: { title: string } } | null>(null)

const createMutation = useAutoApiCreate('posts', {
  onSuccess: (data) => {
    createdPost.value = data
    createTitle.value = ''
    reload()
  },
  onError: err => refused('create', err)
})

const handleCreate = () => {
  sentTitle.value = createTitle.value
  createMutation.mutate({
    title: createTitle.value,
    content: 'Demo content',
    userId: 1,
    published: true
  })
}

// Update Demo
const selectedPostId = ref<number | null>(null)
const updateTitle = ref('')

const updateMutation = useAutoApiUpdate('posts', {
  onSuccess: () => {
    selectedPostId.value = null
    updateTitle.value = ''
    reload()
  },
  onError: err => refused('update', err)
})

const handleUpdate = () => {
  if (selectedPostId.value) {
    updateMutation.mutate({
      id: selectedPostId.value,
      title: updateTitle.value
    })
  }
}

// Delete Demo
const selectedDeleteId = ref<number | null>(null)

const deleteMutation = useAutoApiDelete('posts', {
  onSuccess: () => {
    selectedDeleteId.value = null
    reload()
  },
  onError: err => refused('delete', err)
})

const handleDelete = () => {
  if (selectedDeleteId.value) {
    deleteMutation.mutate(selectedDeleteId.value)
  }
}

// List Demo
const listResult = ref<{ data?: unknown[] } | null>(null)

const handleList = async () => {
  await reload()
  listResult.value = posts.value
}
</script>
