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
        Hidden Fields
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Automatically filters sensitive data like passwords and API keys from all API responses.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="Fields marked as hidden in the module configuration are automatically removed from all API responses, including nested relations. This prevents accidental exposure of sensitive data."
    />

    <div class="space-y-8">
      <!-- User List Demo -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">User List</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            GET <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">/api/users</code>
          </p>
        </template>

        <div v-if="usersLoading">
          <USkeleton class="h-48" />
        </div>

        <div v-else-if="usersError" class="text-red-600">
          Error: {{ usersError }}
        </div>

        <div v-else>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Notice that <code class="font-mono text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-1 py-0.5 rounded">password</code> and
            <code class="font-mono text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-1 py-0.5 rounded">apiKey</code> fields are automatically filtered out:
          </p>
          <ApiResponse :data="users" />
        </div>
      </UCard>

      <!-- Single User Demo -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Single User</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            GET <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">/api/users/1</code>
          </p>
        </template>

        <div v-if="userLoading">
          <USkeleton class="h-48" />
        </div>

        <div v-else-if="userError" class="text-red-600">
          Error: {{ userError }}
        </div>

        <div v-else>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Even when fetching a single user, sensitive fields remain hidden:
          </p>
          <ApiResponse :data="user" />
        </div>
      </UCard>

      <!-- Nested Relations Demo -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Nested Relations</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            GET <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">/api/posts?include=author</code>
          </p>
        </template>

        <div v-if="postsLoading">
          <USkeleton class="h-64" />
        </div>

        <div v-else-if="postsError" class="text-red-600">
          Error: {{ postsError }}
        </div>

        <div v-else>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            When including relations, hidden fields are also filtered from nested objects (check author.password and author.apiKey):
          </p>
          <ApiResponse :data="postsWithAuthor?.data?.slice(0, 2)" />
        </div>
      </UCard>

      <!-- Configuration Example -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Configuration</h2>
        </template>

        <div class="space-y-6">
          <!-- Method 1: Module Registration -->
          <div>
            <h3 class="font-medium mb-2">Method 1: Module Registration (Recommended)</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Configure hidden fields when registering resources in your module:
            </p>

            <CodeBlock
              :code="moduleRegistrationExample"
              language="typescript"
            />
          </div>

          <!-- Method 2: Runtime Config -->
          <div>
            <h3 class="font-medium mb-2">Method 2: Runtime Configuration</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Alternatively, configure in <code class="font-mono text-xs">nuxt.config.ts</code> for global or per-resource hidden fields:
            </p>

            <CodeBlock
              :code="runtimeConfigExample"
              language="typescript"
            />
          </div>

          <UAlert
            icon="i-heroicons-information-circle"
            color="blue"
            variant="subtle"
            title="Best Practice"
            description="Use module registration for type-safe configuration. Use runtime config for global fields like 'password' that should be hidden from all resources."
          />
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
// Fetch users list
const { data: users, isLoading: usersLoading, error: usersError } = useAutoApiList('users', {})

// Fetch single user
const { data: user, isLoading: userLoading, error: userError } = useAutoApiGet('users', 1)

// Fetch posts with author relation
const {
  data: postsWithAuthor,
  isLoading: postsLoading,
  error: postsError
} = useAutoApiList('posts', {
  include: 'author'
})

const moduleRegistrationExample = `// modules/base/index.ts
import { defineNuxtModule, createResolver } from '@nuxt/kit'
import { createModuleImport } from 'nuxt-auto-api/module'

export default defineNuxtModule({
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.hook('autoApi:registerSchema', (registry) => {
      registry.register('users', {
        schema: createModuleImport(resolver.resolve('./schema'), 'users'),
        authorization: createModuleImport(resolver.resolve('./auth'), 'usersAuth'),
        hiddenFields: ['password', 'apiKey'], // ✓ Filtered from all responses
      })
    })
  }
})`

const runtimeConfigExample = `// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-auto-api'],

  autoApi: {
    // Global hidden fields - apply to ALL resources
    hiddenFields: {
      global: ['password', 'createdAt', 'updatedAt'],

      // Per-resource hidden fields
      resources: {
        users: ['apiKey', 'resetToken', 'twoFactorSecret'],
        posts: ['internalNotes'],
        payments: ['stripeSecretKey', 'bankAccountNumber']
      }
    }
  }
})`
</script>
