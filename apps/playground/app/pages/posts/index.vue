<template>
  <UContainer>
    <UPageHeader
      title="Posts"
      description="Browse all posts with TanStack Query-powered data fetching"
    />

    <div class="space-y-6">
      <!-- Filters -->
      <UCard>
        <div class="flex gap-4">
          <USelect
            v-model="selectedStatus"
            :options="statusOptions"
            placeholder="Filter by status"
          />

          <USelect
            v-model="selectedSort"
            :options="sortOptions"
            placeholder="Sort by"
          />

          <UInput
            v-model="searchQuery"
            placeholder="Search posts..."
            icon="i-lucide-search"
          />

          <UButton
            @click="resetFilters"
            color="neutral"
            variant="outline"
          >
            Reset
          </UButton>

          <UButton
            to="/posts/new"
            icon="i-lucide-plus"
            trailing-icon="i-lucide-arrow-right"
          >
            Create Post
          </UButton>
        </div>
      </UCard>

      <!-- Loading State -->
      <div v-if="isLoading" class="space-y-4">
        <USkeleton class="h-32 w-full" v-for="i in 3" :key="i" />
      </div>

      <!-- Error State -->
      <UAlert
        v-else-if="error"
        icon="i-lucide-alert-circle"
        color="error"
        variant="subtle"
        title="Error loading posts"
        :description="error.message"
      >
        <template #actions>
          <UButton @click="refetch" size="xs" color="error" variant="subtle">
            Retry
          </UButton>
        </template>
      </UAlert>

      <!-- Posts List -->
      <div v-else-if="data" class="space-y-4">
        <UCard
          v-for="post in data.data"
          :key="post.id"
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <h3 class="text-lg font-semibold">
                  <NuxtLink
                    :to="`/posts/${post.id}`"
                    class="hover:text-primary-500 transition-colors"
                  >
                    {{ post.title }}
                  </NuxtLink>
                </h3>
                <UBadge
                  :color="post.published ? 'green' : 'gray'"
                  variant="subtle"
                  size="xs"
                >
                  {{ post.published ? 'Published' : 'Draft' }}
                </UBadge>
              </div>

              <p class="text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                {{ post.content }}
              </p>

              <div v-if="post.author" class="flex items-center gap-2 text-sm text-gray-500">
                <UIcon name="i-lucide-user" class="w-4 h-4" />
                <span>{{ post.author.name || post.author.email }}</span>
                <span>•</span>
                <span>{{ formatDate(post.createdAt) }}</span>
              </div>
            </div>

            <div class="flex gap-2">
              <UButton
                :to="`/posts/${post.id}/edit`"
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
              >
                Edit
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Pagination -->
        <UCard v-if="data.meta.total">
          <div class="flex items-center justify-between">
            <div class="text-sm text-gray-600 dark:text-gray-400">
              Showing {{ (currentPage - 1) * pageSize + 1 }} to
              {{ Math.min(currentPage * pageSize, data.meta.total) }}
              of {{ data.meta.total }} posts
            </div>

            <UPagination
              v-model="currentPage"
              :total="data.meta.total"
              :page-size="pageSize"
            />
          </div>
        </UCard>

        <!-- Empty State -->
        <UCard v-if="data.data.length === 0">
          <div class="text-center py-12">
            <UIcon name="i-lucide-file-text" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 class="text-lg font-semibold mb-2">No posts found</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              {{ searchQuery ? 'Try adjusting your filters' : 'Get started by creating your first post' }}
            </p>
            <UButton
              v-if="!searchQuery"
              to="/posts/new"
              icon="i-lucide-plus"
            >
              Create Post
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
// Reactive filters
const selectedStatus = ref<string | null>(null)
const selectedSort = ref('-createdAt')
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

const filters = computed(() => {
  const result: any = {}

  if (selectedStatus.value === 'published') {
    result.published = true
  } else if (selectedStatus.value === 'draft') {
    result.published = false
  }

  if (searchQuery.value) {
    result.title = { $like: searchQuery.value }
  }

  return result
})

// TanStack Query composable for list fetching
const { data, isLoading, error, refetch } = useAutoApiList('posts', computed(() => ({
  include: 'author',
  filter: filters.value,
  sort: selectedSort.value,
  page: currentPage.value,
  limit: pageSize.value
})))

// Options
const statusOptions = [
  { label: 'All', value: null },
  { label: 'Published', value: 'published' },
  { label: 'Drafts', value: 'draft' }
]

const sortOptions = [
  { label: 'Newest first', value: '-createdAt' },
  { label: 'Oldest first', value: 'createdAt' },
  { label: 'Title A-Z', value: 'title' },
  { label: 'Title Z-A', value: '-title' }
]

// Reset filters
function resetFilters() {
  selectedStatus.value = null
  selectedSort.value = '-createdAt'
  searchQuery.value = ''
  currentPage.value = 1
}

// Format date
function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Meta tags
useHead({
  title: 'Posts - Nuxt Auto API Demo'
})
</script>
