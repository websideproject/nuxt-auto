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
        Posts - Object-Level Authorization
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Demonstrates how users can only edit their own posts, while admins can edit all posts.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="Posts have a userId field. The authorization logic checks if the current user's ID matches the post's userId. Admins bypass this check and can edit any post."
    />

    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-semibold">
        All Posts
      </h2>

      <PermissionButton
        resource="posts"
        action="create"
        icon="i-heroicons-plus"
        @click="openCreateModal"
      >
        Create Post
      </PermissionButton>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="space-y-4">
      <USkeleton class="h-32" />
      <USkeleton class="h-32" />
      <USkeleton class="h-32" />
    </div>

    <!-- Error state -->
    <UAlert
      v-else-if="error"
      icon="i-heroicons-exclamation-circle"
      color="error"
      variant="subtle"
      title="Error loading posts"
      :description="String(error)"
    />

    <!-- Posts list -->
    <div v-else-if="posts" class="space-y-4">
      <UCard
        v-for="post in posts.data"
        :key="post.id"
        :ui="{ body: { padding: 'p-6' } }"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <h3 class="text-xl font-semibold">
                  {{ post.title }}
                </h3>
                <UBadge
                  v-if="isOwnPost(post)"
                  color="green"
                  variant="subtle"
                >
                  Your Post
                </UBadge>
                <UBadge
                  v-if="post.published"
                  color="blue"
                  variant="subtle"
                >
                  Published
                </UBadge>
                <UBadge
                  v-else
                  color="gray"
                  variant="subtle"
                >
                  Draft
                </UBadge>
              </div>

              <p class="text-gray-600 dark:text-gray-400 mb-2">
                {{ post.content }}
              </p>

              <p class="text-sm text-gray-500">
                By User ID: {{ post.userId }}
              </p>
            </div>

            <div class="flex gap-2">
              <PermissionButton
                resource="posts"
                action="update"
                icon="i-heroicons-pencil"
                size="sm"
                variant="outline"
                :tooltip-text="getEditTooltip(post)"
                @click="openEditModal(post)"
              >
                Edit
              </PermissionButton>

              <PermissionButton
                resource="posts"
                action="delete"
                icon="i-heroicons-trash"
                size="sm"
                variant="outline"
                color="error"
                @click="openDeleteModal(post)"
              >
                Delete
              </PermissionButton>
            </div>
          </div>

          <!-- Object-level auth explanation -->
          <UAlert
            v-if="!canEditPost(post)"
            icon="i-heroicons-lock-closed"
            color="amber"
            variant="subtle"
            :description="getObjectLevelMessage(post)"
          />
        </div>
      </UCard>

      <div v-if="posts.data.length === 0">
        <UAlert
          icon="i-heroicons-information-circle"
          color="gray"
          variant="subtle"
          title="No posts found"
          description="Create your first post to get started!"
        />
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <UModal v-model="showFormModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">
            {{ editingPost ? 'Edit Post' : 'Create Post' }}
          </h3>
        </template>

        <form @submit.prevent="submitForm" class="space-y-4">
          <UFormGroup label="Title" required>
            <UInput v-model="formData.title" placeholder="Enter post title" />
          </UFormGroup>

          <UFormGroup label="Content" required>
            <UTextarea v-model="formData.content" placeholder="Enter post content" rows="4" />
          </UFormGroup>

          <UFormGroup label="Published">
            <UCheckbox v-model="formData.published" label="Publish this post" />
          </UFormGroup>

          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              variant="outline"
              @click="closeFormModal"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              :loading="isSubmitting"
              :disabled="!formData.title || !formData.content"
            >
              {{ editingPost ? 'Update' : 'Create' }}
            </UButton>
          </div>
        </form>
      </UCard>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model="showDeleteModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-red-600">
            Delete Post
          </h3>
        </template>

        <div class="space-y-4">
          <p>Are you sure you want to delete this post?</p>
          <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded">
            <p class="font-medium">{{ deletingPost?.title }}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ deletingPost?.content }}</p>
          </div>
          <p class="text-sm text-red-600">This action cannot be undone.</p>

          <div class="flex justify-end gap-2">
            <UButton
              variant="outline"
              @click="closeDeleteModal"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              :loading="isDeleting"
              @click="confirmDelete"
            >
              Delete
            </UButton>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
interface Post {
  id: number
  title: string
  content: string
  published: boolean
  userId: number
}

const { user, isAdmin } = useAuth()

const { data: posts, isLoading, error, refetch } = useAutoApiList<Post>('posts', {
  sort: '-createdAt',
})

const toast = useToast()

// Create/Edit modal state
const showFormModal = ref(false)
const editingPost = ref<Post | null>(null)
const isSubmitting = ref(false)
const formData = reactive({
  title: '',
  content: '',
  published: false,
})

// Delete modal state
const showDeleteModal = ref(false)
const deletingPost = ref<Post | null>(null)
const isDeleting = ref(false)

// Create mutation
const { mutateAsync: createPost } = useAutoApiMutation('posts', 'create', {
  toast: {
    success: { title: 'Post created successfully!' },
    error: { title: 'Failed to create post' },
  },
})

// Update mutation
const { mutateAsync: updatePost } = useAutoApiMutation('posts', 'update', {
  toast: {
    success: { title: 'Post updated successfully!' },
    error: { title: 'Failed to update post' },
  },
})

// Delete mutation
const { mutateAsync: deletePost } = useAutoApiMutation('posts', 'delete', {
  toast: {
    success: { title: 'Post deleted successfully!' },
    error: { title: 'Failed to delete post' },
  },
})

function isOwnPost(post: Post): boolean {
  return user.value?.id === post.userId
}

function canEditPost(post: Post): boolean {
  // Admins can edit all posts, users can only edit their own
  return isAdmin.value || isOwnPost(post)
}

function getEditTooltip(post: Post): string | undefined {
  if (canEditPost(post)) {
    return undefined
  }

  if (!user.value) {
    return 'You must be logged in to edit posts'
  }

  return 'You can only edit your own posts (or be an admin)'
}

function getObjectLevelMessage(post: Post): string {
  if (!user.value) {
    return 'Anonymous users cannot edit posts. Log in to edit your own posts.'
  }

  if (isAdmin.value) {
    return 'As an admin, you can edit this post.'
  }

  if (isOwnPost(post)) {
    return 'This is your post, you can edit it.'
  }

  return `This post belongs to User ID ${post.userId}. Only the owner or an admin can edit it.`
}

// Modal handlers
function openCreateModal() {
  editingPost.value = null
  formData.title = ''
  formData.content = ''
  formData.published = false
  showFormModal.value = true
}

function openEditModal(post: Post) {
  if (!canEditPost(post)) return

  editingPost.value = post
  formData.title = post.title
  formData.content = post.content
  formData.published = post.published
  showFormModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingPost.value = null
}

async function submitForm() {
  isSubmitting.value = true

  try {
    if (editingPost.value) {
      // Update existing post
      await updatePost({
        id: editingPost.value.id,
        data: {
          title: formData.title,
          content: formData.content,
          published: formData.published,
        },
      })
    } else {
      // Create new post
      await createPost({
        title: formData.title,
        content: formData.content,
        published: formData.published,
      })
    }

    closeFormModal()
    refetch()
  } catch (err) {
    // Error toast handled by mutation
    console.error('Form submission error:', err)
  } finally {
    isSubmitting.value = false
  }
}

function openDeleteModal(post: Post) {
  deletingPost.value = post
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deletingPost.value = null
}

async function confirmDelete() {
  if (!deletingPost.value) return

  isDeleting.value = true

  try {
    await deletePost(deletingPost.value.id)
    closeDeleteModal()
    refetch()
  } catch (err) {
    // Error toast handled by mutation
    console.error('Delete error:', err)
  } finally {
    isDeleting.value = false
  }
}
</script>
