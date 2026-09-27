<template>
  <div>
    <PermissionDeniedPage
      v-if="error.statusCode === 403"
      :message="error.statusMessage"
    />
    <div
      v-else
      class="min-h-screen flex items-center justify-center bg-muted px-4"
    >
      <UCard class="max-w-lg w-full">
        <div class="text-center space-y-4 py-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-elevated">
            <UIcon
              name="i-heroicons-exclamation-triangle"
              class="h-8 w-8 text-toned"
            />
          </div>

          <div>
            <h1 class="text-2xl font-bold text-highlighted mb-2">
              {{ error.statusCode || 'Error' }}
            </h1>
            <p class="text-toned">
              {{ error.statusMessage || 'An error occurred' }}
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
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRuntimeConfig } from '#app'
import PermissionDeniedPage from '../../components/PermissionDeniedPage.vue'

defineOptions({ name: 'AdminErrorPage' })

defineProps<{
  error: {
    statusCode?: number
    statusMessage?: string
  }
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
