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
        Users - Field-Level Security
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Email addresses are hidden unless viewing your own profile or you're an admin.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="The users resource has field-level permissions on the 'email' field. You can only see email addresses for your own user or if you're an admin. Role field is read-only unless you're an admin."
    />

    <h2 class="text-2xl font-semibold mb-6">
      All Users
    </h2>

    <div v-if="isLoading" class="space-y-4">
      <USkeleton class="h-24" />
      <USkeleton class="h-24" />
    </div>

    <UAlert
      v-else-if="error"
      icon="i-heroicons-exclamation-circle"
      color="error"
      variant="subtle"
      title="Error loading users"
      :description="String(error)"
    />

    <div v-else-if="users" class="space-y-4">
      <UCard
        v-for="userItem in users.data"
        :key="userItem.id"
        :ui="{ body: { padding: 'p-6' } }"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4 flex-1">
            <UAvatar
              :alt="userItem.name"
              size="lg"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-lg font-semibold">
                  {{ userItem.name }}
                </h3>
                <UBadge
                  v-if="isCurrentUser(userItem)"
                  color="green"
                  variant="subtle"
                >
                  You
                </UBadge>
                <UBadge
                  :color="getRoleBadgeColor(userItem.role)"
                  variant="subtle"
                >
                  {{ userItem.role }}
                </UBadge>
              </div>

              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-heroicons-envelope"
                    class="text-gray-400"
                    size="16"
                  />
                  <span
                    v-if="canSeeEmail(userItem)"
                    class="text-sm text-gray-600 dark:text-gray-400"
                  >
                    {{ userItem.email }}
                  </span>
                  <div v-else class="flex items-center gap-2">
                    <span class="text-sm text-gray-400">
                      [Hidden]
                    </span>
                    <UBadge
                      color="amber"
                      variant="subtle"
                      size="xs"
                    >
                      Field-level permission
                    </UBadge>
                  </div>
                </div>

                <p class="text-xs text-gray-500">
                  User ID: {{ userItem.id }}
                </p>
              </div>
            </div>
          </div>

          <PermissionButton
            resource="users"
            action="update"
            icon="i-heroicons-pencil"
            size="sm"
            variant="outline"
          >
            Edit
          </PermissionButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'editor' | 'user'
}

const { user: currentUser, isAdmin } = useAuth()

const { data: users, isLoading, error } = useAutoApiList<User>('users', {
  sort: 'id',
})

function isCurrentUser(userItem: User): boolean {
  return currentUser.value?.id === userItem.id
}

function canSeeEmail(userItem: User): boolean {
  // Can see own email or all emails if admin
  return isCurrentUser(userItem) || isAdmin.value
}

function getRoleBadgeColor(role: string) {
  switch (role) {
    case 'admin':
      return 'red'
    case 'editor':
      return 'blue'
    case 'user':
      return 'green'
    default:
      return 'gray'
  }
}
</script>
