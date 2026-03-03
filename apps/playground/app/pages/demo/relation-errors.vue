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
        Relation Errors
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Helpful error messages guide you when relations are misconfigured or missing.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="When you request a relation that doesn't exist, the API returns a clear error message explaining what's wrong and how to fix it."
    />

    <div class="space-y-8">
      <!-- Trigger Error Demo -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Invalid Relation Example</h2>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Try requesting a relation that doesn't exist:
          </p>

          <UButton
            @click="triggerInvalidRelation"
            :loading="invalidLoading"
            icon="i-heroicons-exclamation-triangle"
            color="error"
          >
            Request Invalid Relation
          </UButton>

          <div v-if="invalidError" class="space-y-3">
            <UAlert
              icon="i-heroicons-exclamation-circle"
              color="error"
              variant="subtle"
              title="Relation Error"
            >
              <template #description>
                <div class="space-y-2">
                  <p>{{ invalidError.message }}</p>
                  <p class="text-xs">Status Code: {{ invalidError.statusCode }}</p>
                </div>
              </template>
            </UAlert>

            <div class="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
              <p class="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                API Response:
              </p>
              <ApiResponse :data="invalidError" />
            </div>
          </div>
        </div>
      </UCard>

      <!-- Side-by-Side Comparison -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-x-circle" class="text-red-500" />
              <h3 class="font-semibold">Incorrect</h3>
            </div>
          </template>

          <div class="space-y-3">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Missing relation definition:
            </p>

            <CodeBlock
              :code="incorrectCode"
              language="typescript"
            />

            <UAlert
              icon="i-heroicons-information-circle"
              color="error"
              variant="subtle"
              title="Problem"
              description="The 'categories' relation is not defined in postsRelations, so including it in the query will fail."
            />
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-check-circle" class="text-green-500" />
              <h3 class="font-semibold">Correct</h3>
            </div>
          </template>

          <div class="space-y-3">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Proper relation definition:
            </p>

            <CodeBlock
              :code="correctCode"
              language="typescript"
            />

            <UAlert
              icon="i-heroicons-check-circle"
              color="green"
              variant="subtle"
              title="Solution"
              description="Add the relation definition to your schema's relations object. Now you can include 'categories' in your queries."
            />
          </div>
        </UCard>
      </div>

      <!-- Try It Yourself -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Try It Yourself</h2>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Test any relation name to see if it exists:
          </p>

          <div class="flex gap-2">
            <UInput
              v-model="testRelation"
              placeholder="Enter relation name (e.g., 'author', 'comments', 'invalid')"
              class="flex-1"
              @keyup.enter="testRelationQuery"
            />
            <UButton
              @click="testRelationQuery"
              :loading="testLoading"
              icon="i-heroicons-play"
              color="green"
            >
              Test
            </UButton>
          </div>

          <div v-if="testResult">
            <UAlert
              v-if="testResult.success"
              icon="i-heroicons-check-circle"
              color="green"
              variant="subtle"
              title="Success!"
              :description="`The '${testRelation}' relation exists and returned ${testResult.count} records.`"
            />

            <div v-else class="space-y-3">
              <UAlert
                icon="i-heroicons-exclamation-circle"
                color="error"
                variant="subtle"
                title="Relation Not Found"
                :description="testResult.error"
              />

              <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <p class="text-sm font-medium mb-2">Full Error Response:</p>
                <ApiResponse :data="testResult.fullError" />
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- How to Fix Guide -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">How to Fix Relation Errors</h2>
        </template>

        <div class="space-y-4">
          <div>
            <h3 class="font-medium mb-2">Step 1: Define the relation in your schema</h3>
            <CodeBlock
              :code="fixStep1"
              language="typescript"
            />
          </div>

          <div>
            <h3 class="font-medium mb-2">Step 2: Configure it in nuxt.config.ts</h3>
            <CodeBlock
              :code="fixStep2"
              language="typescript"
            />
          </div>

          <div>
            <h3 class="font-medium mb-2">Step 3: Use it in your queries</h3>
            <CodeBlock
              :code="fixStep3"
              language="typescript"
            />
          </div>

          <UAlert
            icon="i-heroicons-light-bulb"
            color="blue"
            variant="subtle"
            title="Tip"
            description="Always check your Drizzle schema's relations() definitions match what you're trying to include in API queries."
          />
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const invalidLoading = ref(false)
const invalidError = ref<any>(null)

const testRelation = ref('')
const testLoading = ref(false)
const testResult = ref<any>(null)

const triggerInvalidRelation = async () => {
  invalidLoading.value = true
  invalidError.value = null

  try {
    await $fetch('/api/posts?include=nonexistent')
  } catch (err: any) {
    invalidError.value = {
      message: err.data?.message || err.message || 'Unknown error',
      statusCode: err.statusCode || 500,
      data: err.data
    }
  } finally {
    invalidLoading.value = false
  }
}

const testRelationQuery = async () => {
  if (!testRelation.value.trim()) return

  testLoading.value = true
  testResult.value = null

  try {
    const result = await $fetch(`/api/posts?include=${testRelation.value.trim()}`)
    testResult.value = {
      success: true,
      count: result.data?.length || 0
    }
  } catch (err: any) {
    testResult.value = {
      success: false,
      error: err.data?.message || err.message || 'Unknown error',
      fullError: err.data || err
    }
  } finally {
    testLoading.value = false
  }
}

const incorrectCode = `// schema.ts
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  // Missing categories relation!
}))`

const correctCode = `// schema.ts
export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  categories: many(postCategories), // ✓ Added relation
  comments: many(comments),
}))`

const fixStep1 = `// server/database/schema.ts
import { relations } from 'drizzle-orm'

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),
}))`

const fixStep2 = `// nuxt.config.ts
export default defineNuxtConfig({
  autoApi: {
    resources: {
      posts: {
        table: posts,
        relations: postsRelations, // Make sure to pass relations
        // ...
      }
    }
  }
})`

const fixStep3 = `// Now you can use it!
const { data } = useAutoApiList('posts', {
  include: 'author,comments'
})

// GET /api/posts?include=author,comments`
</script>
