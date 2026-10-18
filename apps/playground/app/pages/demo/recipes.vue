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
        Recipes
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400">
        The cookbook patterns, running: custom endpoints that stay inside the API's rules, and a table made of the
        schema presets. Signed in as <strong>{{ user?.name ?? 'nobody' }}</strong> — switch roles on the demo home.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- rowScope -->
      <UCard>
        <template #header>
          <h3 class="font-semibold">
            Counting only what you may see — <code>rowScope</code>
          </h3>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            <code>GET /api/recipes/post-stats</code> groups posts with the list's own visibility as SQL.
          </p>
        </template>
        <div class="flex items-center gap-6">
          <div>
            <div class="text-3xl font-semibold">
              {{ stats?.published ?? '—' }}
            </div>
            <div class="text-xs text-neutral-500">
              published
            </div>
          </div>
          <div>
            <div class="text-3xl font-semibold">
              {{ stats?.drafts ?? '—' }}
            </div>
            <div class="text-xs text-neutral-500">
              drafts
            </div>
          </div>
          <UButton
            icon="i-heroicons-arrow-path"
            variant="outline"
            color="neutral"
            class="ml-auto"
            @click="loadStats"
          >
            Refresh
          </UButton>
        </div>
      </UCard>

      <!-- named gate -->
      <UCard>
        <template #header>
          <h3 class="font-semibold">
            A gate of its own — <code>endpointName</code>
          </h3>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            Authors may edit only their own posts, but <code>POST /api/recipes/posts/:id/publish</code> is gated by
            <code>custom.publish</code>: editors and admins publish any draft.
          </p>
        </template>
        <div class="flex gap-2">
          <USelect
            v-model="publishId"
            :items="drafts"
            placeholder="Pick a draft"
            class="flex-1"
          />
          <UButton
            :disabled="!publishId"
            icon="i-heroicons-rocket-launch"
            @click="publish"
          >
            Publish
          </UButton>
        </div>
        <p
          v-if="publishResult"
          class="mt-3 text-sm"
          :class="publishResult.ok ? 'text-success' : 'text-error'"
        >
          {{ publishResult.message }}
        </p>
      </UCard>

      <!-- authorize + insertReturning -->
      <UCard>
        <template #header>
          <h3 class="font-semibold">
            Checking rows, then writing — <code>authorize</code> + <code>insertReturning</code>
          </h3>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            <code>POST /api/recipes/posts/duplicate</code> copies posts you may read as your own drafts; one you may not
            read refuses the whole request.
          </p>
        </template>
        <div class="space-y-1.5 mb-3">
          <UCheckbox
            v-for="post in firstPosts"
            :key="post.id"
            v-model="duplicateIds"
            :value="post.id"
            :label="`#${post.id} ${post.title}`"
          />
        </div>
        <UButton
          :disabled="!duplicateIds.length"
          icon="i-heroicons-document-duplicate"
          @click="duplicate"
        >
          Duplicate {{ duplicateIds.length || '' }}
        </UButton>
        <p
          v-if="duplicateResult"
          class="mt-3 text-sm"
          :class="duplicateResult.ok ? 'text-success' : 'text-error'"
        >
          {{ duplicateResult.message }}
        </p>
      </UCard>

      <!-- presets + soft delete -->
      <UCard>
        <template #header>
          <h3 class="font-semibold">
            Schema presets and the trash — <code>notes</code>
          </h3>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            <code>id()</code>, <code>timestamps()</code>, <code>audit()</code> and <code>softDelete()</code>: notes
            are private (<code>listFilter</code> on <code>createdBy</code>), and deleting one moves it to the trash.
          </p>
        </template>
        <p
          v-if="!user"
          class="text-sm text-neutral-500"
        >
          Sign in on the demo home to keep notes.
        </p>
        <template v-else>
          <div class="flex gap-2 mb-3">
            <UInput
              v-model="noteTitle"
              placeholder="A new note"
              class="flex-1"
              @keydown.enter="addNote"
            />
            <UButton
              :disabled="!noteTitle.trim()"
              icon="i-heroicons-plus"
              @click="addNote"
            >
              Add
            </UButton>
          </div>
          <ul class="divide-y divide-default text-sm">
            <li
              v-for="note in notes"
              :key="note.id"
              class="flex items-center justify-between py-1.5"
            >
              <span>{{ note.title }}</span>
              <UButton
                icon="i-heroicons-trash"
                size="xs"
                variant="ghost"
                color="error"
                aria-label="Move to trash"
                @click="trash(note.id)"
              />
            </li>
          </ul>
          <h4 class="mt-4 mb-1 text-xs font-medium text-neutral-500 uppercase">
            Trash
          </h4>
          <ul class="divide-y divide-default text-sm">
            <li
              v-for="note in trashed"
              :key="note.id"
              class="flex items-center justify-between py-1.5 text-neutral-500"
            >
              <span class="line-through">{{ note.title }}</span>
              <UButton
                size="xs"
                variant="ghost"
                icon="i-heroicons-arrow-uturn-left"
                @click="restore(note.id)"
              >
                Restore
              </UButton>
            </li>
            <li
              v-if="!trashed.length"
              class="py-1.5 text-neutral-500"
            >
              Empty
            </li>
          </ul>
        </template>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Post { id: number, title: string, published: boolean }
interface Note { id: string, title: string }

const { user, fetchSession } = useAuth()
const message = (e: unknown) => (e as { data?: { message?: string } })?.data?.message || (e as Error).message

// rowScope
const stats = ref<{ published: number, drafts: number } | null>(null)
async function loadStats() {
  stats.value = (await $fetch<{ data: { published: number, drafts: number } }>('/api/recipes/post-stats')).data
}

// Posts for the pickers
const posts = ref<Post[]>([])
async function loadPosts() {
  posts.value = (await $fetch<{ data: Post[] }>('/api/posts', { query: { limit: 50, sort: 'id' } })).data
}
const drafts = computed(() => posts.value.filter(p => !p.published).map(p => ({ label: `#${p.id} ${p.title}`, value: p.id })))
const firstPosts = computed(() => posts.value.slice(0, 5))

// Named gate
const publishId = ref<number | undefined>()
const publishResult = ref<{ ok: boolean, message: string } | null>(null)
async function publish() {
  try {
    const { data } = await $fetch<{ data: Post }>(`/api/recipes/posts/${publishId.value}/publish`, { method: 'POST' })
    publishResult.value = { ok: true, message: `Published "${data.title}"` }
    publishId.value = undefined
    await Promise.all([loadPosts(), loadStats()])
  } catch (e) {
    publishResult.value = { ok: false, message: message(e) }
  }
}

// authorize + insertReturning
const duplicateIds = ref<number[]>([])
const duplicateResult = ref<{ ok: boolean, message: string } | null>(null)
async function duplicate() {
  try {
    const { data } = await $fetch<{ data: Post[] }>('/api/recipes/posts/duplicate', { method: 'POST', body: { ids: duplicateIds.value } })
    duplicateResult.value = { ok: true, message: `Created ${data.map(p => `#${p.id}`).join(', ')} as your drafts` }
    duplicateIds.value = []
    await Promise.all([loadPosts(), loadStats()])
  } catch (e) {
    duplicateResult.value = { ok: false, message: message(e) }
  }
}

// Notes: soft delete, trash, restore
const notes = ref<Note[]>([])
const trashed = ref<Note[]>([])
const noteTitle = ref('')
async function loadNotes() {
  if (!user.value) return
  const [live, trash] = await Promise.all([
    $fetch<{ data: Note[] }>('/api/notes', { query: { sort: 'createdAt' } }),
    $fetch<{ data: Note[] }>('/api/notes', { query: { onlyDeleted: 'true' } })
  ])
  notes.value = live.data
  trashed.value = trash.data
}
async function addNote() {
  if (!noteTitle.value.trim()) return
  await $fetch('/api/notes', { method: 'POST', body: { title: noteTitle.value.trim() } })
  noteTitle.value = ''
  await loadNotes()
}
async function trash(id: string) {
  await $fetch(`/api/notes/${id}`, { method: 'DELETE' })
  await loadNotes()
}
async function restore(id: string) {
  await $fetch(`/api/notes/${id}/restore`, { method: 'POST' })
  await loadNotes()
}

onMounted(async () => {
  await fetchSession()
  await Promise.all([loadStats(), loadPosts(), loadNotes()])
})
</script>
