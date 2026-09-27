<template>
  <div class="container mx-auto py-8 px-4 max-w-6xl">
    <div class="mb-6">
      <UButton
        to="/demo"
        icon="i-heroicons-arrow-left"
        variant="ghost"
        color="neutral"
        class="mb-4"
      >
        Back to Demo Home
      </UButton>

      <h1 class="text-4xl font-bold mb-2">
        Users - Field-Level Security
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        The API decides which fields each caller receives: email is sent to admins, and to anyone else only on their
        own record.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="A field rule on 'email' sends it to admins always, and to anyone else only on their own record (GET /api/users/:id), never in a list. An objectLevel rule lists a non-admin only themselves, and only admins may change 'role'. [Hidden] means the API did not send the field."
    />

    <h2 class="text-2xl font-semibold mb-6">
      All Users
    </h2>

    <div
      v-if="isLoading"
      class="space-y-4"
    >
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

    <div
      v-else-if="users"
      class="space-y-4"
    >
      <UCard
        v-for="userItem in users.data"
        :key="userItem.id"
        :ui="{ body: 'p-6' }"
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
                  color="success"
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
                    v-if="emailOf(userItem)"
                    class="text-sm text-gray-600 dark:text-gray-400"
                  >
                    {{ emailOf(userItem) }}
                  </span>
                  <div
                    v-else
                    class="flex items-center gap-2"
                  >
                    <span class="text-sm text-gray-400">
                      [Hidden]
                    </span>
                    <UBadge
                      color="warning"
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
  email?: string
  role: 'admin' | 'editor' | 'user'
}

const { user: currentUser, isAdmin } = useAuth()

const { data: users, isLoading, error } = useAutoApiList<User>('users', {
  sort: 'id'
})

function isCurrentUser(userItem: User): boolean {
  return currentUser.value?.id === userItem.id
}

// The list carries email only for an admin. Anyone else gets their own from GET /api/users/:id, the one route
// where the field rule (which reads the request, not the row) lets it through.
const { data: me } = useAutoApiGet<User>('users', computed(() => currentUser.value?.id ?? 0), undefined, {
  enabled: computed(() => !!currentUser.value && !isAdmin.value)
})

function emailOf(userItem: User): string | undefined {
  return userItem.email ?? (isCurrentUser(userItem) ? me.value?.data?.email : undefined)
}

function getRoleBadgeColor(role: string) {
  switch (role) {
    case 'admin':
      return 'error'
    case 'editor':
      return 'info'
    case 'user':
      return 'success'
    default:
      return 'neutral'
  }
}
</script>
