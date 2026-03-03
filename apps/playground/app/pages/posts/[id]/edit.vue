<template>
  <UContainer>
    <UPageHeader
      title="Edit Post"
      description="Update post details"
    />

    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-4">
      <USkeleton class="h-12 w-full" />
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
        <UButton to="/posts" size="xs" color="gray" variant="subtle">
          Back to Posts
        </UButton>
      </template>
    </UAlert>

    <!-- Form -->
    <PostForm
      v-else-if="postData"
      :initial-data="postData.data"
      :loading="isUpdating"
      :is-new="false"
      @submit="handleUpdate"
    />
  </UContainer>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const toast = useToast()

const postId = computed(() => route.params.id as string)

// Redirect if ID is 'new' (handled by posts/new.vue)
// This prevents [id]/edit.vue from handling /posts/new/edit if someone navigates there manually
// or if the previous redirect was cached/bookmarked
if (postId.value === 'new') {
  throw createError({ statusCode: 404, message: 'Page not found' })
}

// Fetch existing post
const { data: postData, isLoading, error } = useAutoApiGet(
  'posts',
  postId,
  undefined
)

// Update mutation
const { mutate: updatePost, isPending: isUpdating } = useAutoApiUpdate('posts', {
  onSuccess: (response) => {
    toast.add({
      title: 'Post updated',
      description: 'Your changes have been saved',
      color: 'green'
    })
    router.push(`/posts/${response.data.id}`)
  },
  onError: (err) => {
    toast.add({
      title: 'Update failed',
      description: err.message,
      color: 'red'
    })
  }
})

function handleUpdate(data: any) {
  updatePost({
    id: postId.value,
    ...data
  })
}

// Meta tags
useHead({
  title: computed(() => postData.value ? `Edit ${postData.value.data.title}` : 'Edit Post')
})
</script>
