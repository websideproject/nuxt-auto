<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        Configure your application settings and preferences
      </p>
    </div>

    <!-- Settings Sections -->
    <div class="grid gap-6">
      <!-- General Settings -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <UIcon name="i-heroicons-cog-6-tooth" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">General Settings</h2>
          </div>
        </template>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Application Name
            </label>
            <UInput v-model="settings.appName" placeholder="Enter application name" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contact Email
            </label>
            <UInput v-model="settings.contactEmail" type="email" placeholder="admin@example.com" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timezone
            </label>
            <USelectMenu v-model="settings.timezone" :options="timezones" />
          </div>
        </div>
      </UCard>

      <!-- Appearance Settings -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <UIcon name="i-heroicons-paint-brush" class="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Appearance</h2>
          </div>
        </template>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Enable dark mode for the admin panel</div>
            </div>
            <UToggle v-model="settings.darkMode" />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Compact Mode</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Use compact layout with reduced spacing</div>
            </div>
            <UToggle v-model="settings.compactMode" />
          </div>
        </div>
      </UCard>

      <!-- Notification Settings -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <UIcon name="i-heroicons-bell" class="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Notifications</h2>
          </div>
        </template>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Email Notifications</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Receive email updates about important events</div>
            </div>
            <UToggle v-model="settings.emailNotifications" />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Push Notifications</div>
              <div class="text-sm text-gray-600 dark:text-gray-400">Receive push notifications in your browser</div>
            </div>
            <UToggle v-model="settings.pushNotifications" />
          </div>
        </div>
      </UCard>

      <!-- Actions -->
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" @click="resetSettings">Reset to Defaults</UButton>
        <UButton @click="saveSettings" :loading="saving">
          Save Changes
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  layout: 'admin',
})

const settings = ref({
  appName: 'Auto Admin Demo',
  contactEmail: 'admin@example.com',
  timezone: 'UTC',
  darkMode: false,
  compactMode: false,
  emailNotifications: true,
  pushNotifications: false,
})

const timezones = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const saving = ref(false)

async function saveSettings() {
  saving.value = true
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  saving.value = false

  // Show success toast
  const toast = useToast()
  toast.add({
    title: 'Settings saved',
    description: 'Your settings have been saved successfully',
    color: 'green',
  })
}

function resetSettings() {
  settings.value = {
    appName: 'Auto Admin Demo',
    contactEmail: 'admin@example.com',
    timezone: 'UTC',
    darkMode: false,
    compactMode: false,
    emailNotifications: true,
    pushNotifications: false,
  }
}
</script>
