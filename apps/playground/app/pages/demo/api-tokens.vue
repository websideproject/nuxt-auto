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
        API Token Authentication
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Create, manage, and test API tokens with scoped access. Tokens authenticate API requests via Bearer header.
      </p>
    </div>

    <UAlert
      icon="i-heroicons-information-circle"
      color="blue"
      variant="subtle"
      class="mb-6"
      title="How it works"
      description="API tokens are hashed with SHA-256 before storage. The raw token is shown only once on creation. Scopes limit which resources/operations a token can access. The existing resource authorization (role checks, object-level) still applies on top of scopes."
    />

    <!-- Seeded Test Tokens -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-beaker" class="text-purple-500" />
          <h2 class="text-xl font-semibold">Pre-Seeded Test Tokens</h2>
        </div>
      </template>

      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        These tokens are created by the seed script. Use them to quickly test Bearer auth without creating new tokens.
      </p>

      <div class="space-y-3">
        <div
          v-for="token in seededTokens"
          :key="token.raw"
          class="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium text-sm">{{ token.label }}</span>
              <UBadge :color="token.badgeColor" variant="subtle" size="xs">
                {{ token.role }}
              </UBadge>
            </div>
            <code class="text-xs text-gray-500 break-all">{{ token.raw }}</code>
            <div class="mt-1">
              <span class="text-xs text-gray-400">Scopes: </span>
              <UBadge
                v-for="scope in token.scopes"
                :key="scope"
                color="gray"
                variant="subtle"
                size="xs"
                class="mr-1"
              >
                {{ scope }}
              </UBadge>
            </div>
          </div>
          <UButton
            size="xs"
            variant="outline"
            icon="i-heroicons-clipboard"
            @click="copyToClipboard(token.raw)"
          >
            Copy
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Token Tester -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-play" class="text-green-500" />
          <h2 class="text-xl font-semibold">Token Tester</h2>
        </div>
      </template>

      <div class="space-y-4">
        <UFormGroup label="Bearer Token">
          <UInput
            v-model="testToken"
            placeholder="sk_test_admin_unrestricted"
            icon="i-heroicons-key"
          />
        </UFormGroup>

        <div class="flex gap-2 flex-wrap">
          <UButton
            v-for="preset in seededTokens"
            :key="preset.raw"
            size="xs"
            variant="soft"
            :color="preset.badgeColor"
            @click="testToken = preset.raw"
          >
            {{ preset.label }}
          </UButton>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <UFormGroup label="Method">
              <USelect v-model="testMethod" :items="['GET', 'POST', 'PATCH', 'DELETE']" />
            </UFormGroup>
          </div>
          <div>
            <UFormGroup label="Endpoint">
              <UInput v-model="testEndpoint" placeholder="/api/articles" />
            </UFormGroup>
          </div>
        </div>

        <div class="flex gap-2 flex-wrap">
          <UButton size="xs" variant="outline" @click="setTest('GET', '/api/articles')">
            GET /api/articles
          </UButton>
          <UButton size="xs" variant="outline" @click="setTest('POST', '/api/articles')">
            POST /api/articles
          </UButton>
          <UButton size="xs" variant="outline" @click="setTest('GET', '/api/posts')">
            GET /api/posts
          </UButton>
          <UButton size="xs" variant="outline" @click="setTest('GET', '/api/users')">
            GET /api/users
          </UButton>
          <UButton size="xs" variant="outline" @click="setTest('GET', '/api/_token/introspect')">
            Introspect
          </UButton>
        </div>

        <UFormGroup v-if="testMethod === 'POST' || testMethod === 'PATCH'" label="Request Body (JSON)">
          <UTextarea
            v-model="testBody"
            placeholder='{ "title": "Test", "content": "Hello", "slug": "test", "published": true, "authorId": 1 }'
            rows="3"
            class="font-mono text-sm"
          />
        </UFormGroup>

        <UButton
          :loading="isTesting"
          icon="i-heroicons-paper-airplane"
          @click="runTest"
        >
          Send Request
        </UButton>

        <!-- Test Result -->
        <div v-if="testResult" class="mt-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="font-medium text-sm">Response</span>
            <UBadge
              :color="testResult.ok ? 'green' : 'red'"
              variant="subtle"
            >
              {{ testResult.status }} {{ testResult.statusText }}
            </UBadge>
          </div>
          <pre class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">{{ testResult.body }}</pre>
        </div>
      </div>
    </UCard>

    <!-- Scope Enforcement Demo -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-shield-check" class="text-amber-500" />
          <h2 class="text-xl font-semibold">Scope Enforcement Demo</h2>
        </div>
      </template>

      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Click each button to test how token scopes restrict access. The editor token only has
        <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">articles:read</code>,
        <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">articles:create</code>, and
        <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">articles:update</code> scopes.
      </p>

      <div class="space-y-3">
        <div
          v-for="test in scopeTests"
          :key="test.label"
          class="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <code class="text-sm font-medium">{{ test.method }} {{ test.endpoint }}</code>
              <UBadge
                v-if="test.result !== null"
                :color="test.result ? 'green' : 'red'"
                variant="subtle"
                size="xs"
              >
                {{ test.result ? 'Allowed' : 'Denied' }}
              </UBadge>
            </div>
            <span class="text-xs text-gray-500">{{ test.description }}</span>
          </div>
          <UButton
            size="xs"
            :loading="test.loading"
            variant="outline"
            @click="runScopeTest(test)"
          >
            Test
          </UButton>
        </div>
      </div>

      <div class="mt-4">
        <UButton variant="soft" size="sm" @click="runAllScopeTests" :loading="runningAllScopes">
          Run All Tests
        </UButton>
      </div>
    </UCard>

    <!-- Token Management (CRUD via session auth) -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-key" class="text-blue-500" />
            <h2 class="text-xl font-semibold">Your API Keys</h2>
          </div>
          <UButton
            icon="i-heroicons-plus"
            size="sm"
            @click="openCreateModal"
            :disabled="!user"
          >
            Create Key
          </UButton>
        </div>
      </template>

      <UAlert
        v-if="!user"
        icon="i-heroicons-exclamation-triangle"
        color="amber"
        variant="subtle"
        class="mb-4"
        title="Authentication required"
        description="Switch to a user role using the role switcher to manage API keys."
      />

      <div v-if="isLoading" class="space-y-3">
        <USkeleton class="h-16" />
        <USkeleton class="h-16" />
      </div>

      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-circle"
        color="error"
        variant="subtle"
        title="Error loading API keys"
        :description="String(error)"
      />

      <div v-else-if="apiKeys" class="space-y-3">
        <div
          v-for="key in apiKeys.data"
          :key="key.id"
          class="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium">{{ key.name }}</span>
              <UBadge color="gray" variant="subtle" size="xs">
                ID: {{ key.id }}
              </UBadge>
              <UBadge
                v-if="key.expiresAt"
                :color="isExpired(key.expiresAt) ? 'red' : 'green'"
                variant="subtle"
                size="xs"
              >
                {{ isExpired(key.expiresAt) ? 'Expired' : 'Active' }}
              </UBadge>
            </div>
            <div class="flex items-center gap-2 mb-1">
              <code class="text-xs text-gray-500">{{ key.key }}</code>
            </div>
            <div v-if="key.scopes && key.scopes.length" class="flex gap-1 flex-wrap">
              <UBadge
                v-for="scope in key.scopes"
                :key="scope"
                color="blue"
                variant="subtle"
                size="xs"
              >
                {{ scope }}
              </UBadge>
            </div>
            <span v-else class="text-xs text-gray-400">No scopes (unrestricted)</span>
            <div v-if="key.lastUsedAt" class="mt-1">
              <span class="text-xs text-gray-400">Last used: {{ formatDate(key.lastUsedAt) }}</span>
            </div>
          </div>
          <div class="flex gap-1">
            <UButton
              size="xs"
              variant="outline"
              icon="i-heroicons-arrow-path"
              @click="rotateKey(key)"
              :loading="rotatingId === key.id"
            >
              Rotate
            </UButton>
            <UButton
              size="xs"
              variant="outline"
              color="error"
              icon="i-heroicons-trash"
              @click="openDeleteModal(key)"
            >
              Delete
            </UButton>
          </div>
        </div>

        <UAlert
          v-if="apiKeys.data.length === 0"
          icon="i-heroicons-information-circle"
          color="gray"
          variant="subtle"
          title="No API keys"
          description="Create your first API key to get started."
        />
      </div>

      <!-- New token reveal -->
      <UAlert
        v-if="revealedToken"
        icon="i-heroicons-exclamation-triangle"
        color="amber"
        variant="subtle"
        class="mt-4"
        title="Save your token now!"
      >
        <template #description>
          <p class="mb-2">This is the only time you will see the raw token. Copy it now:</p>
          <div class="flex items-center gap-2">
            <code class="bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded text-sm break-all flex-1">{{ revealedToken }}</code>
            <UButton
              size="xs"
              variant="outline"
              icon="i-heroicons-clipboard"
              @click="copyToClipboard(revealedToken!)"
            >
              Copy
            </UButton>
          </div>
        </template>
      </UAlert>
    </UCard>

    <!-- Create Modal -->
    <UModal v-model="showCreateModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold">Create API Key</h3>
        </template>

        <form class="space-y-4" @submit.prevent="submitCreate">
          <UFormGroup label="Name" required>
            <UInput v-model="createForm.name" placeholder="My API Key" />
          </UFormGroup>

          <UFormGroup label="Scopes" hint="Leave empty for unrestricted access">
            <div class="space-y-2">
              <div v-for="(scope, idx) in createForm.scopes" :key="idx" class="flex gap-2">
                <UInput
                  v-model="createForm.scopes[idx]"
                  placeholder="articles:read"
                  class="flex-1"
                />
                <UButton
                  size="xs"
                  variant="outline"
                  color="error"
                  icon="i-heroicons-x-mark"
                  @click="createForm.scopes.splice(idx, 1)"
                />
              </div>
              <UButton
                size="xs"
                variant="outline"
                icon="i-heroicons-plus"
                @click="createForm.scopes.push('')"
              >
                Add Scope
              </UButton>
            </div>
            <div class="mt-2 flex gap-1 flex-wrap">
              <UButton
                v-for="preset in scopePresets"
                :key="preset"
                size="xs"
                variant="soft"
                color="gray"
                @click="addScopePreset(preset)"
              >
                {{ preset }}
              </UButton>
            </div>
          </UFormGroup>

          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="showCreateModal = false">
              Cancel
            </UButton>
            <UButton
              type="submit"
              :loading="isCreating"
              :disabled="!createForm.name"
            >
              Create
            </UButton>
          </div>
        </form>
      </UCard>
    </UModal>

    <!-- Delete Modal -->
    <UModal v-model="showDeleteModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-red-600">Delete API Key</h3>
        </template>

        <div class="space-y-4">
          <p>Are you sure you want to delete this API key?</p>
          <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded">
            <p class="font-medium">{{ deletingKey?.name }}</p>
            <code class="text-sm text-gray-500">{{ deletingKey?.key }}</code>
          </div>
          <p class="text-sm text-red-600">Any applications using this token will lose access immediately.</p>

          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="showDeleteModal = false">
              Cancel
            </UButton>
            <UButton
              color="error"
              :loading="isDeleting"
              @click="confirmDelete"
            >
              Delete
            </UButton>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
interface ApiKey {
  id: number
  name: string
  key: string
  userId: number
  scopes: string[] | null
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

const { user } = useAuth()
const toast = useToast()

// --- Seeded test tokens ---
const seededTokens = [
  {
    label: 'Admin (unrestricted)',
    raw: 'sk_test_admin_unrestricted',
    role: 'admin',
    badgeColor: 'red' as const,
    scopes: ['*'],
  },
  {
    label: 'Editor (articles r/w)',
    raw: 'sk_test_editor_articles',
    role: 'editor',
    badgeColor: 'blue' as const,
    scopes: ['articles:read', 'articles:create', 'articles:update'],
  },
  {
    label: 'User (read-only)',
    raw: 'sk_test_user_readonly',
    role: 'user',
    badgeColor: 'green' as const,
    scopes: ['articles:read', 'posts:read', 'categories:read', 'tags:read'],
  },
]

// --- Token Tester ---
const testToken = ref('sk_test_admin_unrestricted')
const testMethod = ref('GET')
const testEndpoint = ref('/api/articles')
const testBody = ref('')
const isTesting = ref(false)
const testResult = ref<{ ok: boolean; status: number; statusText: string; body: string } | null>(null)

function setTest(method: string, endpoint: string) {
  testMethod.value = method
  testEndpoint.value = endpoint
  if (method === 'POST' && endpoint === '/api/articles') {
    testBody.value = JSON.stringify({
      title: 'Test Article',
      content: 'Created via API token',
      slug: 'test-article-' + Date.now(),
      published: true,
      authorId: 1,
    }, null, 2)
  }
}

async function runTest() {
  isTesting.value = true
  testResult.value = null
  try {
    const fetchOptions: any = {
      method: testMethod.value,
      headers: {} as Record<string, string>,
    }
    if (testToken.value) {
      fetchOptions.headers.Authorization = `Bearer ${testToken.value}`
    }
    if ((testMethod.value === 'POST' || testMethod.value === 'PATCH') && testBody.value) {
      try {
        fetchOptions.body = JSON.parse(testBody.value)
      }
      catch {
        toast.add({ title: 'Invalid JSON in request body', color: 'error' })
        isTesting.value = false
        return
      }
    }

    const response = await $fetch.raw(testEndpoint.value, fetchOptions)
    testResult.value = {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      body: JSON.stringify(response._data, null, 2),
    }
  }
  catch (err: any) {
    const status = err?.response?.status || err?.statusCode || 0
    const statusText = err?.response?.statusText || err?.statusMessage || 'Error'
    const body = err?.response?._data || err?.data || { message: err?.message || String(err) }
    testResult.value = {
      ok: false,
      status,
      statusText,
      body: JSON.stringify(body, null, 2),
    }
  }
  finally {
    isTesting.value = false
  }
}

// --- Scope Enforcement Demo ---
const scopeTests = reactive([
  {
    label: 'Read articles',
    method: 'GET',
    endpoint: '/api/articles',
    description: 'articles:read scope required',
    result: null as boolean | null,
    loading: false,
  },
  {
    label: 'Create article',
    method: 'POST',
    endpoint: '/api/articles',
    description: 'articles:create scope required',
    result: null as boolean | null,
    loading: false,
  },
  {
    label: 'Read posts',
    method: 'GET',
    endpoint: '/api/posts',
    description: 'posts:read scope required - editor token LACKS this',
    result: null as boolean | null,
    loading: false,
  },
  {
    label: 'Read users',
    method: 'GET',
    endpoint: '/api/users',
    description: 'users:read scope required - editor token LACKS this',
    result: null as boolean | null,
    loading: false,
  },
  {
    label: 'Delete article',
    method: 'DELETE',
    endpoint: '/api/articles/1',
    description: 'articles:delete scope required - editor token LACKS this',
    result: null as boolean | null,
    loading: false,
  },
])

const runningAllScopes = ref(false)

async function runScopeTest(test: (typeof scopeTests)[number]) {
  test.loading = true
  test.result = null
  const editorToken = 'sk_test_editor_articles'
  try {
    const fetchOptions: any = {
      method: test.method,
      headers: { Authorization: `Bearer ${editorToken}` },
    }
    if (test.method === 'POST') {
      fetchOptions.body = {
        title: 'Scope Test',
        content: 'Testing scope enforcement',
        slug: 'scope-test-' + Date.now(),
        published: false,
        authorId: 2,
      }
    }
    await $fetch.raw(test.endpoint, fetchOptions)
    test.result = true
  }
  catch (err: any) {
    const status = err?.response?.status || err?.statusCode || 0
    // 403 = scope denied, other errors may also indicate denial
    test.result = status < 400
  }
  finally {
    test.loading = false
  }
}

async function runAllScopeTests() {
  runningAllScopes.value = true
  for (const test of scopeTests) {
    await runScopeTest(test)
  }
  runningAllScopes.value = false
}

// --- Token CRUD ---
const { data: apiKeys, isLoading, error, refetch } = useAutoApiList<ApiKey>('apiKeys', { sort: '-createdAt' })

const showCreateModal = ref(false)
const isCreating = ref(false)
const revealedToken = ref<string | null>(null)
const createForm = reactive({
  name: '',
  scopes: [] as string[],
})

const showDeleteModal = ref(false)
const deletingKey = ref<ApiKey | null>(null)
const isDeleting = ref(false)
const rotatingId = ref<number | null>(null)

const scopePresets = [
  'articles:read',
  'articles:create',
  'articles:update',
  'articles:delete',
  'posts:read',
  'posts:create',
  'users:read',
  '*',
]

function addScopePreset(scope: string) {
  if (!createForm.scopes.includes(scope)) {
    createForm.scopes.push(scope)
  }
}

function openCreateModal() {
  createForm.name = ''
  createForm.scopes = []
  revealedToken.value = null
  showCreateModal.value = true
}

async function submitCreate() {
  isCreating.value = true
  try {
    const scopes = createForm.scopes.filter(s => s.trim())
    const response = await $fetch<{ data: ApiKey }>('/api/apiKeys', {
      method: 'POST',
      body: {
        name: createForm.name,
        ...(scopes.length ? { scopes } : {}),
      },
    })
    revealedToken.value = response.data.key
    showCreateModal.value = false
    toast.add({ title: 'API key created!', color: 'success' })
    refetch()
  }
  catch (err: any) {
    const msg = err?.data?.message || err?.message || 'Failed to create API key'
    toast.add({ title: msg, color: 'error' })
  }
  finally {
    isCreating.value = false
  }
}

function openDeleteModal(key: ApiKey) {
  deletingKey.value = key
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!deletingKey.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/apiKeys/${deletingKey.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'API key deleted', color: 'success' })
    showDeleteModal.value = false
    deletingKey.value = null
    refetch()
  }
  catch (err: any) {
    const msg = err?.data?.message || err?.message || 'Failed to delete API key'
    toast.add({ title: msg, color: 'error' })
  }
  finally {
    isDeleting.value = false
  }
}

async function rotateKey(key: ApiKey) {
  rotatingId.value = key.id
  try {
    const response = await $fetch<{ data: ApiKey }>(`/api/apiKeys/${key.id}`, {
      method: 'PATCH',
      body: { _rotate: true },
    })
    revealedToken.value = response.data.key
    toast.add({ title: 'Token rotated! Save the new token.', color: 'success' })
    refetch()
  }
  catch (err: any) {
    const msg = err?.data?.message || err?.message || 'Failed to rotate token'
    toast.add({ title: msg, color: 'error' })
  }
  finally {
    rotatingId.value = null
  }
}

function isExpired(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: 'Copied to clipboard', color: 'success' })
  }
  catch {
    toast.add({ title: 'Failed to copy', color: 'error' })
  }
}
</script>
