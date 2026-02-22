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
        Lifecycle Hooks
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Before/after CRUD hooks for audit logging, validation, and side effects.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="Hooks execute at specific points in the request lifecycle. Use before* hooks for validation/transformation, and after* hooks for logging/notifications."
    />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Activity Feed (left column on large screens) -->
      <div class="lg:col-span-1">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">Hook Activity Feed</h2>
              <UButton
                icon="i-heroicons-trash"
                size="xs"
                variant="ghost"
                color="gray"
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
            <h3 class="font-semibold">Create Hook Demo</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              beforeCreate hook transforms title to uppercase
            </p>
          </template>

          <div class="space-y-4">
            <UInput
              v-model="createTitle"
              placeholder="Enter post title (try lowercase)"
              size="md"
            />

            <UButton
              @click="handleCreate"
              :loading="createMutation.isPending.value"
              icon="i-heroicons-plus"
              color="green"
            >
              Create Post
            </UButton>

            <div v-if="createdPost" class="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
              <p class="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                ✓ Post created successfully!
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Original: <code>{{ createTitle }}</code>
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Transformed: <code class="font-bold">{{ createdPost.data.title }}</code>
              </p>
            </div>
          </div>
        </UCard>

        <!-- Update Demo -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">Update Hook Demo</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              afterUpdate hook logs changes
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
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              >
                <option :value="null">-- Select a post --</option>
                <option v-for="post in posts?.data?.slice(0, 5)" :key="post.id" :value="post.id">
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
                @click="handleUpdate"
                :loading="updateMutation.isPending.value"
                icon="i-heroicons-pencil"
                color="green"
                class="mt-3"
              >
                Update Post
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Delete Demo -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">Delete Hook Demo</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              beforeDelete hook validates permissions
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
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              >
                <option :value="null">-- Select a post --</option>
                <option v-for="post in posts?.data?.slice(0, 5)" :key="post.id" :value="post.id">
                  {{ post.title }}
                </option>
              </select>

              <UButton
                v-if="selectedDeleteId"
                @click="handleDelete"
                :loading="deleteMutation.isPending.value"
                icon="i-heroicons-trash"
                color="error"
                class="mt-3"
              >
                Delete Post
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- List Demo -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">List Hook Demo</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              afterList hook logs query execution
            </p>
          </template>

          <div class="space-y-4">
            <UButton
              @click="handleList"
              :loading="postsLoading"
              icon="i-heroicons-list-bullet"
              color="green"
            >
              Fetch Posts
            </UButton>

            <div v-if="listResult" class="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <p class="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                ✓ Fetched {{ listResult.data?.length || 0 }} posts
              </p>
            </div>
          </div>
        </UCard>

        <!-- Execution Order Diagram -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">Hook Execution Order</h3>
          </template>

          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-sm">
                1
              </div>
              <div class="flex-1">
                <p class="font-medium text-sm">beforeCreate / beforeUpdate / beforeDelete</p>
                <p class="text-xs text-gray-500">Validate, transform, or reject the operation</p>
              </div>
            </div>

            <div class="flex items-center gap-3 ml-4">
              <div class="w-0.5 h-8 bg-gray-300 dark:bg-gray-700"></div>
            </div>

            <div class="flex items-center gap-3">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-gray-700 dark:text-gray-300 font-semibold text-sm">
                2
              </div>
              <div class="flex-1">
                <p class="font-medium text-sm">Database Operation</p>
                <p class="text-xs text-gray-500">Execute the actual query</p>
              </div>
            </div>

            <div class="flex items-center gap-3 ml-4">
              <div class="w-0.5 h-8 bg-gray-300 dark:bg-gray-700"></div>
            </div>

            <div class="flex items-center gap-3">
              <div class="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-700 dark:text-green-300 font-semibold text-sm">
                3
              </div>
              <div class="flex-1">
                <p class="font-medium text-sm">afterCreate / afterUpdate / afterDelete</p>
                <p class="text-xs text-gray-500">Log, notify, or trigger side effects</p>
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

const activityFeed = ref<ActivityEvent[]>([])

const addActivity = (hook: string, message: string, type: 'before' | 'after' | 'error' = 'after') => {
  activityFeed.value.unshift({
    hook,
    message,
    type,
    timestamp: new Date()
  })

  // Keep only last 20 events
  if (activityFeed.value.length > 20) {
    activityFeed.value = activityFeed.value.slice(0, 20)
  }
}

const clearActivity = () => {
  activityFeed.value = []
}

// Fetch posts
const { data: posts, isLoading: postsLoading, refetch } = useAutoApiList('posts', {})

// Create Demo
const createTitle = ref('')
const createdPost = ref<any>(null)

const createMutation = useAutoApiCreate('posts', {
  onMutate: () => {
    addActivity('beforeCreate', `Validating and transforming title: "${createTitle.value}"`, 'before')
  },
  onSuccess: (data) => {
    createdPost.value = data
    addActivity('afterCreate', `Post created with ID ${data.data.id}. Title was uppercased.`, 'after')
    createTitle.value = ''
    refetch()
  },
  onError: (err) => {
    addActivity('onError', `Failed to create post: ${err.message}`, 'error')
  }
})

const handleCreate = () => {
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
  onMutate: () => {
    addActivity('beforeUpdate', `Preparing to update post ${selectedPostId.value}`, 'before')
  },
  onSuccess: (data) => {
    addActivity('afterUpdate', `Post ${selectedPostId.value} updated successfully`, 'after')
    selectedPostId.value = null
    updateTitle.value = ''
    refetch()
  },
  onError: (err) => {
    addActivity('onError', `Failed to update post: ${err.message}`, 'error')
  }
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
  onMutate: () => {
    addActivity('beforeDelete', `Validating permissions for post ${selectedDeleteId.value}`, 'before')
  },
  onSuccess: () => {
    addActivity('afterDelete', `Post ${selectedDeleteId.value} deleted successfully`, 'after')
    selectedDeleteId.value = null
    refetch()
  },
  onError: (err) => {
    addActivity('onError', `Failed to delete post: ${err.message}`, 'error')
  }
})

const handleDelete = () => {
  if (selectedDeleteId.value) {
    deleteMutation.mutate(selectedDeleteId.value)
  }
}

// List Demo
const listResult = ref<any>(null)

const handleList = async () => {
  addActivity('beforeList', 'Executing list query', 'before')
  await refetch()
  listResult.value = posts.value
  addActivity('afterList', `Fetched ${posts.value?.data?.length || 0} posts`, 'after')
}
</script>
