<template>
  <USelectMenu
    v-model="selectedRole"
    :items="menuItems"
    value-key="value"
    placeholder="Select role..."
    :loading="isLoading"
    size="md"
    class="w-[220px]"
    :ui="{
      width: 'w-[220px]',
      option: {
        base: 'cursor-pointer select-none relative flex items-center justify-between gap-2',
        padding: 'px-3 py-2.5',
      },
    }"
    @update:model-value="handleRoleChange"
  >
<!--    <template #label>-->
<!--      <div class="flex items-center gap-2 min-w-0">-->
<!--        <span class="text-lg">{{ currentRoleIcon }}</span>-->
<!--        <span class="truncate">{{ currentRoleLabel }}</span>-->
<!--      </div>-->
<!--    </template>-->

<!--    <template #option="{ option }">-->
<!--      <div class="flex items-center gap-2.5 flex-1 min-w-0">-->
<!--        <span class="text-lg flex-shrink-0">{{ option.icon }}</span>-->
<!--        <span class="flex-1 truncate">{{ option.displayLabel }}</span>-->
<!--      </div>-->
<!--    </template>-->
  </USelectMenu>
</template>

<script setup lang="ts">
const { user, isLoading, role, switchRole } = useAuth()

const selectedRole = computed({
  get: () => role.value,
  set: () => {}, // Handled by handleRoleChange
})

const roleLabel = computed(() => {
  return role.value.charAt(0).toUpperCase() + role.value.slice(1)
})

const badgeColor = computed(() => {
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

const menuItems = [
  {
    label: '👑 Admin User',
    value: 'admin',
    displayLabel: 'Admin User',
  },
  {
    label: '✏️ Editor User',
    value: 'editor',
    displayLabel: 'Editor User',
  },
  {
    label: '👤 Regular User',
    value: 'user',
    displayLabel: 'Regular User',
  },
  {
    label: '🚪 Anonymous (Logout)',
    value: 'anonymous',
    displayLabel: 'Anonymous (Logout)',
  },
]

const currentRoleIcon = computed(() => {
  const item = menuItems.find(item => item.value === role.value)
  return item?.icon || '👤'
})

const currentRoleLabel = computed(() => {
  const item = menuItems.find(item => item.value === role.value)
  return item?.displayLabel || 'Select role'
})

function handleRoleChange(newRole: string) {
  switchRole(newRole as 'admin' | 'editor' | 'user' | 'anonymous')
}
</script>
