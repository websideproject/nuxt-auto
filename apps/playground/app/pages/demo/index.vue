<template>
  <div class="container mx-auto py-8 px-4 max-w-6xl">
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2">
        Interactive Permission Demo
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Explore how authorization works by switching between different user roles. See permissions update in real-time!
      </p>
    </div>

    <!-- Current Session Card -->
    <UCard class="mb-8">
      <template #header>
        <h2 class="text-2xl font-semibold">
          Current Session
        </h2>
      </template>

      <div class="space-y-4">
        <div v-if="user" class="flex items-center gap-4">
          <UAvatar
            :alt="user.name"
            size="lg"
          />
          <div>
            <p class="font-semibold text-lg">
              {{ user.name }}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ user.email }}
            </p>
            <UBadge
              :color="roleBadgeColor"
              variant="subtle"
              class="mt-1"
            >
              {{ role.charAt(0).toUpperCase() + role.slice(1) }}
            </UBadge>
          </div>
        </div>

        <div v-else class="flex items-center gap-4">
          <UAvatar
            alt="Anonymous"
            size="lg"
          />
          <div>
            <p class="font-semibold text-lg">
              Not logged in
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Anonymous user (read-only access)
            </p>
            <UBadge
              color="gray"
              variant="subtle"
              class="mt-1"
            >
              Anonymous
            </UBadge>
          </div>
        </div>

        <UAlert
          icon="i-heroicons-information-circle"
          color="blue"
          variant="subtle"
          title="Quick Role Switching"
          description="Use the role switcher in the top-right corner to instantly switch between different user roles and see how permissions change."
        />
      </div>
    </UCard>

    <!-- Permission Matrix -->
    <UCard class="mb-8">
      <template #header>
        <h2 class="text-2xl font-semibold">
          Permission Matrix
        </h2>
      </template>

      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-3 px-4">
                Resource
              </th>
              <th class="text-center py-3 px-4">
                Create
              </th>
              <th class="text-center py-3 px-4">
                Read
              </th>
              <th class="text-center py-3 px-4">
                Update
              </th>
              <th class="text-center py-3 px-4">
                Delete
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="resource in resources"
              :key="resource"
              class="border-b border-gray-100 dark:border-gray-800"
            >
              <td class="py-3 px-4 font-medium">
                {{ resource }}
              </td>
              <td class="py-3 px-4">
                <PermissionCell :resource="resource" action="create" />
              </td>
              <td class="py-3 px-4">
                <PermissionCell :resource="resource" action="read" />
              </td>
              <td class="py-3 px-4">
                <PermissionCell :resource="resource" action="update" />
              </td>
              <td class="py-3 px-4">
                <PermissionCell :resource="resource" action="delete" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Demo Scenarios -->
    <div class="mb-8">
      <h2 class="text-2xl font-semibold mb-4">
        Explore Demo Scenarios
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Posts Demo -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-document-text"
                class="text-blue-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  Posts - Object-Level Authorization
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Users can only edit their own posts. Admins can edit all posts.
                </p>
                <UButton
                  to="/demo/posts"
                  color="blue"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  Try Posts Demo
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Articles Demo -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-newspaper"
                class="text-green-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  Articles - Role-Based Restrictions
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Only editors and admins can create/edit articles. Users can read published articles.
                </p>
                <UButton
                  to="/demo/articles"
                  color="green"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  Try Articles Demo
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Users Demo -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-users"
                class="text-purple-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  Users - Field-Level Security
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Email addresses are hidden unless viewing your own profile or you're an admin.
                </p>
                <UButton
                  to="/demo/users"
                  color="purple"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  Try Users Demo
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Documentation -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-book-open"
                class="text-orange-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  Documentation
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Learn how the permission system works and how to use it in your projects.
                </p>
                <UButton
                  to="/demo/docs"
                  color="orange"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  View Docs
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Hidden Fields -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-eye-slash"
                class="text-red-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  Hidden Fields
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Automatically filter sensitive data like passwords and API keys from all responses.
                </p>
                <UButton
                  to="/demo/hidden-fields"
                  color="error"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  Try Hidden Fields
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Nested Relations -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-link"
                class="text-cyan-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  Nested Relations
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Enhanced include syntax with field selection, filtering, and pagination.
                </p>
                <UButton
                  to="/demo/nested-relations"
                  color="cyan"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  Try Nested Relations
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Bulk Operations -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-squares-2x2"
                class="text-indigo-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  Bulk Operations
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Atomic create, update, and delete operations for multiple records at once.
                </p>
                <UButton
                  to="/demo/bulk-operations"
                  color="indigo"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  Try Bulk Operations
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Aggregations -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-chart-bar"
                class="text-teal-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  Aggregations
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Count, sum, avg, min, max with groupBy and having for data analysis.
                </p>
                <UButton
                  to="/demo/aggregations"
                  color="teal"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  Try Aggregations
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Lifecycle Hooks -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-bolt"
                class="text-yellow-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  Lifecycle Hooks
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Before/after CRUD hooks for audit logging, validation, and side effects.
                </p>
                <UButton
                  to="/demo/hooks"
                  color="yellow"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  Try Lifecycle Hooks
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Relation Errors -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="text-pink-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  Relation Errors
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Helpful error messages guide you when relations are misconfigured.
                </p>
                <UButton
                  to="/demo/relation-errors"
                  color="pink"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  Try Relation Errors
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- API Tokens -->
        <UCard
          :ui="{ body: { padding: 'p-6' } }"
        >
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-heroicons-key"
                class="text-amber-500 mt-1"
                size="24"
              />
              <div class="flex-1">
                <h3 class="font-semibold text-lg mb-1">
                  API Token Authentication
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Create scoped API keys, test Bearer auth, and see scope enforcement in action.
                </p>
                <UButton
                  to="/demo/api-tokens"
                  color="amber"
                  variant="outline"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  Try API Tokens
                </UButton>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user, role } = useAuth()

const resources = ['posts', 'articles', 'users', 'categories']

const roleBadgeColor = computed(() => {
  switch (role.value) {
    case 'admin':
      return 'red'
    case 'editor':
      return 'blue'
    case 'user':
      return 'green'
    default:
      return 'gray'
  }
})
</script>
