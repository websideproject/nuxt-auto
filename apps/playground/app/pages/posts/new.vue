<template>
  <UContainer>
    <UPageHeader
      title="Create Post"
      description="Create a new blog post"
    />

    <PostForm
      :is-new="true"
      :loading="isCreating"
      @submit="handleCreate"
    />
  </UContainer>
</template>

<script setup lang="ts">
const router = useRouter()
const toast = useToast()

// Create mutation
const { mutate: createPost, isPending: isCreating } = useAutoApiCreate('posts', {
  onSuccess: (response) => {
    toast.add({
      title: 'Post created',
      description: 'Your post has been successfully created',
      color: 'green'
    })
    router.push(`/posts/${response.data.id}`)
  },
  onError: (err) => {
    toast.add({
      title: 'Create failed',
      description: err.message,
      color: 'red'
    })
  }
})

function handleCreate(data: any) {
  createPost(data)
}

// Meta tags
useHead({
  title: 'Create Post'
})
</script>