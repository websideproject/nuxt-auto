<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Form -->
    <UCard class="lg:col-span-1">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ isNew ? 'Create New Post' : 'Edit Post' }}
        </h3>
      </template>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Title -->
        <UFormGroup
          label="Title"
          name="title"
          required
          :error="validationErrors.title"
        >
          <UInput
            v-model="form.title"
            placeholder="Enter post title"
            size="xl"
            :disabled="loading"
          />
        </UFormGroup>

        <!-- Content -->
        <UFormGroup
          label="Content"
          name="content"
          :error="validationErrors.content"
        >
          <UTextarea
            v-model="form.content"
            placeholder="Write your post content..."
            :rows="12"
            :disabled="loading"
          />
        </UFormGroup>

        <!-- Author (User) -->
        <UFormGroup
          label="Author"
          name="userId"
          required
          :error="validationErrors.userId"
        >
          <USelectMenu
            v-model="form.userId"
            :options="userOptions"
            placeholder="Select author"
            :loading="isLoadingUsers"
            :disabled="loading"
            value-attribute="value"
          />
        </UFormGroup>

        <!-- Published Status -->
        <UFormGroup
          label="Status"
          name="published"
        >
          <div class="flex items-center gap-3">
            <USwitch
              v-model="form.published"
              :disabled="loading"
            />
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ form.published ? 'Published' : 'Draft' }}
            </span>
          </div>
        </UFormGroup>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <UButton
            type="button"
            @click="handleReset"
            color="neutral"
            variant="ghost"
            :disabled="loading"
          >
            {{ isNew ? 'Clear' : 'Reset' }}
          </UButton>

          <UButton
            type="submit"
            :icon="isNew ? 'i-lucide-plus' : 'i-lucide-save'"
            :loading="loading"
            color="primary"
          >
            {{ isNew ? 'Create Post' : 'Save Changes' }}
          </UButton>
        </div>
      </form>
    </UCard>

    <!-- Preview Card -->
    <UCard class="lg:col-span-1 lg:sticky lg:top-4 h-fit">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Preview</h3>
          <UBadge :color="form.published ? 'green' : 'gray'" variant="subtle">
            {{ form.published ? 'Published' : 'Draft' }}
          </UBadge>
        </div>
      </template>

      <div class="space-y-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ form.title || 'Untitled Post' }}
          </h2>
          <p v-if="form.userId" class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            By {{ getUserName(form.userId) }}
          </p>
        </div>

        <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
          <p class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {{ form.content || 'No content yet. Start typing to see your post preview...' }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  initialData?: any
  loading?: boolean
  isNew?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', data: any): void
}>()

const toast = useToast()

// Fetch users for author select
const { data: usersData, isLoading: isLoadingUsers } = useAutoApiList('users', {
  fields: 'id,name,email'
})

const userOptions = computed(() => {
  if (!usersData.value) return []
  return usersData.value.data.map((user: any) => ({
    label: user.name || user.email,
    value: user.id
  }))
})

// Get user name for preview
function getUserName(userId: number | null) {
  if (!userId || !usersData.value) return 'Unknown Author'
  const user = usersData.value.data.find((u: any) => u.id === userId)
  return user?.name || user?.email || 'Unknown Author'
}

// Form state
const form = reactive({
  title: '',
  content: '',
  userId: null as number | null,
  published: false
})

const validationErrors = reactive({
  title: '',
  content: '',
  userId: ''
})

// Initialize form
watch(() => props.initialData, (data) => {
  if (data) {
    form.title = data.title
    form.content = data.content || ''
    form.userId = data.userId
    form.published = data.published
  }
}, { immediate: true })

// Validate form
function validate() {
  validationErrors.title = ''
  validationErrors.content = ''
  validationErrors.userId = ''

  let isValid = true

  if (!form.title.trim()) {
    validationErrors.title = 'Title is required'
    isValid = false
  }

  if (!form.userId) {
    validationErrors.userId = 'Author is required'
    isValid = false
  }

  return isValid
}

// Handle submit
function handleSubmit() {
  if (!validate()) {
    toast.add({
      title: 'Validation error',
      description: 'Please fix the errors before submitting',
      color: 'red'
    })
    return
  }

  emit('submit', { ...form })
}

// Reset form
function handleReset() {
  if (props.initialData) {
    form.title = props.initialData.title
    form.content = props.initialData.content || ''
    form.userId = props.initialData.userId
    form.published = props.initialData.published
  } else {
    form.title = ''
    form.content = ''
    form.userId = null
    form.published = false
  }

  // Clear validation errors
  validationErrors.title = ''
  validationErrors.content = ''
  validationErrors.userId = ''
}
</script>
