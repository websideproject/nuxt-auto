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
        Bulk Operations
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Atomic create, update, and delete operations for multiple records in a single request.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="Bulk operations are atomic - either all changes succeed or all are rolled back. This ensures data consistency when modifying multiple records."
    />

    <div class="space-y-8">
      <!-- Bulk Create -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Bulk Create</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            POST <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">/api/posts/bulk</code>
          </p>
        </template>

        <BulkOperationForm
          ref="createFormRef"
          :fields="createFields"
          :initial-rows="3"
          submit-label="Create All"
          :loading="bulkCreateMutation.isPending.value"
          @submit="handleBulkCreate"
        />

        <div v-if="createResult" class="mt-4">
          <p class="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
            ✓ Successfully created {{ createResult.data?.length }} posts
          </p>
          <ApiResponse :data="createResult" />
        </div>
      </UCard>

      <!-- Bulk Update -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Bulk Update</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            PATCH <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">/api/posts/bulk</code>
          </p>
        </template>

        <div v-if="postsLoading">
          <USkeleton class="h-48" />
        </div>

        <div v-else-if="postsError" class="text-red-600">
          Error: {{ postsError }}
        </div>

        <div v-else class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Select posts to update, modify their titles, then click Update Selected:
          </p>

          <div class="space-y-3">
            <div
              v-for="post in posts?.data?.slice(0, 5)"
              :key="post.id"
              class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <UCheckbox
                v-model="selectedForUpdate"
                :value="post.id"
              />
              <UInput
                v-model="updateTitles[post.id]"
                :placeholder="post.title"
                class="flex-1"
              />
            </div>
          </div>

          <UButton
            @click="handleBulkUpdate"
            :loading="bulkUpdateMutation.isPending.value"
            :disabled="selectedForUpdate.length === 0"
            icon="i-heroicons-pencil"
            color="green"
          >
            Update Selected ({{ selectedForUpdate.length }})
          </UButton>

          <div v-if="updateResult" class="mt-4">
            <p class="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
              ✓ Successfully updated {{ updateResult.data?.length }} posts
            </p>
            <ApiResponse :data="updateResult" />
          </div>
        </div>
      </UCard>

      <!-- Bulk Delete -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Bulk Delete</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            DELETE <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">/api/posts/bulk</code>
          </p>
        </template>

        <div v-if="postsLoading">
          <USkeleton class="h-48" />
        </div>

        <div v-else-if="postsError" class="text-red-600">
          Error: {{ postsError }}
        </div>

        <div v-else class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Select posts to delete (this action cannot be undone):
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              v-for="post in posts?.data"
              :key="post.id"
              class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <UCheckbox
                v-model="selectedForDelete"
                :value="post.id"
              />
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm">{{ post.title }}</p>
                <p class="text-xs text-gray-500">ID: {{ post.id }}</p>
              </div>
            </div>
          </div>

          <UButton
            @click="confirmDelete"
            :disabled="selectedForDelete.length === 0"
            icon="i-heroicons-trash"
            color="error"
          >
            Delete Selected ({{ selectedForDelete.length }})
          </UButton>

          <div v-if="deleteResult" class="mt-4">
            <p class="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
              ✓ Successfully deleted {{ deleteResult.deleted }} posts
            </p>
            <ApiResponse :data="deleteResult" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal v-model="showDeleteModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Confirm Bulk Delete</h3>
        </template>

        <p class="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete {{ selectedForDelete.length }} posts? This action cannot be undone.
        </p>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              color="gray"
              @click="showDeleteModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              :loading="bulkDeleteMutation.isPending.value"
              @click="handleBulkDelete"
            >
              Delete {{ selectedForDelete.length }} Posts
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// Fetch posts
const { data: posts, isLoading: postsLoading, error: postsError, refetch } = useAutoApiList('posts', {})

// Bulk Create
const createFormRef = ref(null)
const createResult = ref(null)
const createFields = [
  { name: 'title', label: 'Title', placeholder: 'Post title', required: true },
  { name: 'content', label: 'Content', placeholder: 'Post content', required: true }
]

const bulkCreateMutation = useAutoApiBulkCreate('posts', {
  onSuccess: (data) => {
    createResult.value = data
    createFormRef.value?.reset()
    refetch()
  }
})

const handleBulkCreate = (data: any[]) => {
  // Add userId and published fields
  const postsData = data.map(item => ({
    ...item,
    userId: 1,
    published: true
  }))
  bulkCreateMutation.mutate(postsData)
}

// Bulk Update
const selectedForUpdate = ref<number[]>([])
const updateTitles = ref<Record<number, string>>({})
const updateResult = ref(null)

const bulkUpdateMutation = useAutoApiBulkUpdate('posts', {
  onSuccess: (data) => {
    updateResult.value = data
    selectedForUpdate.value = []
    updateTitles.value = {}
    refetch()
  }
})

const handleBulkUpdate = () => {
  const updates = selectedForUpdate.value.map(id => ({
    id,
    title: updateTitles.value[id] || posts.value?.data?.find((p: any) => p.id === id)?.title
  }))
  bulkUpdateMutation.mutate(updates)
}

// Bulk Delete
const selectedForDelete = ref<number[]>([])
const showDeleteModal = ref(false)
const deleteResult = ref(null)

const bulkDeleteMutation = useAutoApiBulkDelete('posts', {
  onSuccess: (data) => {
    deleteResult.value = data
    selectedForDelete.value = []
    showDeleteModal.value = false
    refetch()
  }
})

const confirmDelete = () => {
  showDeleteModal.value = true
}

const handleBulkDelete = () => {
  bulkDeleteMutation.mutate(selectedForDelete.value)
}

// Initialize update titles when posts load
watch(posts, (newPosts) => {
  if (newPosts?.data) {
    newPosts.data.forEach((post: any) => {
      if (!updateTitles.value[post.id]) {
        updateTitles.value[post.id] = post.title
      }
    })
  }
}, { immediate: true })
</script>
