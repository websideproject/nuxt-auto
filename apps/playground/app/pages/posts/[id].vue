<template>
  <UContainer>
    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-6">
      <USkeleton class="h-12 w-3/4" />
      <USkeleton class="h-6 w-1/2" />
      <USkeleton class="h-64 w-full" />
    </div>

    <!-- Error State -->
    <UAlert
      v-else-if="error"
      icon="i-lucide-alert-circle"
      color="error"
      variant="subtle"
      title="Error loading post"
      :description="error.message"
    >
      <template #actions>
        <UButton @click="refetch" size="xs" color="error" variant="subtle">
          Retry
        </UButton>
        <UButton to="/posts" size="xs" color="gray" variant="subtle">
          Back to Posts
        </UButton>
      </template>
    </UAlert>

    <!-- Post Content -->
    <div v-else-if="data" class="space-y-6">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-4">
            <UButton
              to="/posts"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              size="sm"
            >
              Back
            </UButton>
            <UBadge
              :color="data.data.published ? 'green' : 'gray'"
              variant="subtle"
            >
              {{ data.data.published ? 'Published' : 'Draft' }}
            </UBadge>
          </div>

          <h1 class="text-4xl font-bold mb-4">{{ data.data.title }}</h1>

          <div v-if="data.data.author" class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-user" class="w-4 h-4" />
              <span>{{ data.data.author.name || data.data.author.email }}</span>
            </div>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-calendar" class="w-4 h-4" />
              <span>{{ formatDate(data.data.createdAt) }}</span>
            </div>
            <div v-if="data.data.updatedAt !== data.data.createdAt" class="flex items-center gap-2">
              <UIcon name="i-lucide-clock" class="w-4 h-4" />
              <span>Updated {{ formatDate(data.data.updatedAt) }}</span>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <UButton
            :to="`/posts/${postId}/edit`"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
          >
            Edit
          </UButton>

          <UButton
            @click="handleDelete"
            icon="i-lucide-trash-2"
            color="error"
            variant="outline"
            :loading="isDeleting"
          >
            Delete
          </UButton>
        </div>
      </div>

      <!-- Content -->
      <UCard>
        <div class="prose dark:prose-invert max-w-none">
          <p class="whitespace-pre-wrap">{{ data.data.content }}</p>
        </div>
      </UCard>

      <!-- Comments Section -->
      <UCard v-if="data.data.comments">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">
              Comments ({{ data.data.comments.length }})
            </h2>
            <UButton
              icon="i-lucide-message-circle"
              size="sm"
              color="neutral"
              variant="outline"
            >
              Add Comment
            </UButton>
          </div>

          <div v-if="data.data.comments.length === 0" class="text-center py-8 text-gray-500">
            <UIcon name="i-lucide-message-circle" class="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No comments yet. Be the first to comment!</p>
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="comment in data.data.comments"
              :key="comment.id"
              class="border-l-2 border-gray-200 dark:border-gray-700 pl-4"
            >
              <div class="flex items-center gap-2 mb-2 text-sm">
                <span class="font-medium">
                  {{ comment.author?.name || comment.author?.email || 'Unknown' }}
                </span>
                <span class="text-gray-500">•</span>
                <span class="text-gray-500">{{ formatDate(comment.createdAt) }}</span>
              </div>
              <p class="text-gray-700 dark:text-gray-300">{{ comment.content }}</p>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Metadata -->
      <UCard title="Post Details">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-600 dark:text-gray-400">Post ID:</span>
            <span class="ml-2 font-mono">{{ data.data.id }}</span>
          </div>
          <div>
            <span class="text-gray-600 dark:text-gray-400">Author ID:</span>
            <span class="ml-2 font-mono">{{ data.data.userId }}</span>
          </div>
          <div>
            <span class="text-gray-600 dark:text-gray-400">Created:</span>
            <span class="ml-2">{{ formatFullDate(data.data.createdAt) }}</span>
          </div>
          <div>
            <span class="text-gray-600 dark:text-gray-400">Updated:</span>
            <span class="ml-2">{{ formatFullDate(data.data.updatedAt) }}</span>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal
      v-model:open="isDeleteModalOpen"
      title="Delete Post"
      :description="`Are you sure you want to delete &quot;${data?.data.title}&quot;? This action cannot be undone.`"
    >
      <template #footer>
        <UButton
          @click="isDeleteModalOpen = false"
          color="neutral"
          variant="outline"
        >
          Cancel
        </UButton>
        <UButton
          @click="confirmDelete"
          color="error"
          :loading="isDeleting"
        >
          Delete
        </UButton>
      </template>
    </UModal>
  </UContainer>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const toast = useToast()

const postId = computed(() => route.params.id as string)

// TanStack Query composable for fetching single post
const { data, isLoading, error, refetch } = useAutoApiGet('posts', postId, computed(() => ({
  include: 'author,comments.author'
})))

// TanStack Mutation for delete
const { mutate: deletePost, isPending: isDeleting } = useAutoApiDelete('posts', {
  onSuccess: () => {
    toast.add({
      title: 'Post deleted',
      description: 'The post has been successfully deleted',
      color: 'green'
    })
    router.push('/posts')
  },
  onError: (err) => {
    toast.add({
      title: 'Delete failed',
      description: err.message,
      color: 'red'
    })
  }
})

// Delete modal state
const isDeleteModalOpen = ref(false)

function handleDelete() {
  isDeleteModalOpen.value = true
}

function confirmDelete() {
  deletePost(postId.value)
  isDeleteModalOpen.value = false
}

// Format date
function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatFullDate(date: Date | string) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Meta tags
useHead({
  title: computed(() => data.value ? `${data.value.data.title} - Posts` : 'Loading...')
})
</script>
