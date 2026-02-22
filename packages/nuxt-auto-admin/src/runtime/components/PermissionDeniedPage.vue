<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <UCard class="max-w-lg w-full">
      <div class="text-center space-y-4 py-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20">
          <UIcon name="i-heroicons-shield-exclamation" class="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Permission Denied
          </h1>
          <p class="text-gray-600 dark:text-gray-400">
            {{ message || "You don't have permission to access this page." }}
          </p>
        </div>

        <div class="flex gap-3 justify-center pt-4">
          <UButton
            variant="outline"
            @click="goBack"
          >
            Go Back
          </UButton>
          <UButton
            @click="goToAdmin"
          >
            Go to Dashboard
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  message?: string
}>()

const router = useRouter()
const config = useRuntimeConfig()
const adminPrefix = config.public.autoAdmin?.prefix || '/admin'

function goBack() {
  router.back()
}

function goToAdmin() {
  router.push(adminPrefix)
}
</script>
