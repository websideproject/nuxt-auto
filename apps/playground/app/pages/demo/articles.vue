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
        Articles - Role-Based Restrictions
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Only editors and admins can create/edit articles. Regular users can read published articles only.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="The articles resource has role-based permissions. Create/update operations require 'editor' or 'admin' role. Read operations are allowed for published articles only (unless you're an editor/admin)."
    />

    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-semibold">
        All Articles
      </h2>

      <PermissionButton
        resource="articles"
        action="create"
        icon="i-heroicons-plus"
        @click="openCreateModal"
      >
        Create Article
      </PermissionButton>
    </div>

    <div v-if="isLoading" class="space-y-4">
      <USkeleton class="h-32" />
      <USkeleton class="h-32" />
    </div>

    <UAlert
      v-else-if="error"
      icon="i-heroicons-exclamation-circle"
      color="error"
      variant="subtle"
      title="Error loading articles"
      :description="String(error)"
    />

    <div v-else-if="articles" class="space-y-4">
      <UCard
        v-for="article in articles.data"
        :key="article.id"
        :ui="{ body: { padding: 'p-6' } }"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <h3 class="text-xl font-semibold">
                  {{ article.title }}
                </h3>
                <UBadge
                  v-if="article.published"
                  color="green"
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
                {{ article.content }}
              </p>

              <p class="text-sm text-gray-500">
                Slug: {{ article.slug }}
              </p>
            </div>

            <div class="flex gap-2">
              <PermissionButton
                resource="articles"
                action="update"
                icon="i-heroicons-pencil"
                size="sm"
                variant="outline"
                @click="openEditModal(article)"
              >
                Edit
              </PermissionButton>

              <PermissionButton
                resource="articles"
                action="delete"
                icon="i-heroicons-trash"
                size="sm"
                variant="outline"
                color="error"
                @click="openDeleteModal(article)"
              >
                Delete
              </PermissionButton>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Create/Edit Modal -->
    <UModal v-model="showFormModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">
            {{ editingArticle ? 'Edit Article' : 'Create Article' }}
          </h3>
        </template>

        <form @submit.prevent="submitForm" class="space-y-4">
          <UFormGroup label="Title" required>
            <UInput v-model="formData.title" placeholder="Enter article title" />
          </UFormGroup>

          <UFormGroup label="Slug" required>
            <UInput v-model="formData.slug" placeholder="url-friendly-slug" />
          </UFormGroup>

          <UFormGroup label="Content" required>
            <UTextarea v-model="formData.content" placeholder="Enter article content" rows="4" />
          </UFormGroup>

          <UFormGroup label="Published">
            <UCheckbox v-model="formData.published" label="Publish this article" />
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
              :disabled="!formData.title || !formData.slug || !formData.content"
            >
              {{ editingArticle ? 'Update' : 'Create' }}
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
            Delete Article
          </h3>
        </template>

        <div class="space-y-4">
          <p>Are you sure you want to delete this article?</p>
          <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded">
            <p class="font-medium">{{ deletingArticle?.title }}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ deletingArticle?.content }}</p>
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
interface Article {
  id: number
  title: string
  content: string
  slug: string
  published: boolean
  authorId: number | null
}

const { data: articles, isLoading, error, refetch } = useAutoApiList<Article>('articles', {
  sort: '-createdAt',
})

// Create/Edit modal state
const showFormModal = ref(false)
const editingArticle = ref<Article | null>(null)
const isSubmitting = ref(false)
const formData = reactive({
  title: '',
  slug: '',
  content: '',
  published: false,
})

// Delete modal state
const showDeleteModal = ref(false)
const deletingArticle = ref<Article | null>(null)
const isDeleting = ref(false)

// Create mutation
const { mutateAsync: createArticle } = useAutoApiMutation('articles', 'create', {
  toast: {
    success: { title: 'Article created successfully!' },
    error: { title: 'Failed to create article' },
  },
})

// Update mutation
const { mutateAsync: updateArticle } = useAutoApiMutation('articles', 'update', {
  toast: {
    success: { title: 'Article updated successfully!' },
    error: { title: 'Failed to update article' },
  },
})

// Delete mutation
const { mutateAsync: deleteArticle } = useAutoApiMutation('articles', 'delete', {
  toast: {
    success: { title: 'Article deleted successfully!' },
    error: { title: 'Failed to delete article' },
  },
})

// Modal handlers
function openCreateModal() {
  editingArticle.value = null
  formData.title = ''
  formData.slug = ''
  formData.content = ''
  formData.published = false
  showFormModal.value = true
}

function openEditModal(article: Article) {
  editingArticle.value = article
  formData.title = article.title
  formData.slug = article.slug
  formData.content = article.content
  formData.published = article.published
  showFormModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingArticle.value = null
}

async function submitForm() {
  isSubmitting.value = true

  try {
    if (editingArticle.value) {
      // Update existing article
      await updateArticle({
        id: editingArticle.value.id,
        data: {
          title: formData.title,
          slug: formData.slug,
          content: formData.content,
          published: formData.published,
        },
      })
    } else {
      // Create new article
      await createArticle({
        title: formData.title,
        slug: formData.slug,
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

function openDeleteModal(article: Article) {
  deletingArticle.value = article
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deletingArticle.value = null
}

async function confirmDelete() {
  if (!deletingArticle.value) return

  isDeleting.value = true

  try {
    await deleteArticle(deletingArticle.value.id)
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
