<template>
  <div class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">API Response</span>
      <UButton
        :icon="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="copyJson"
      />
    </div>
    <pre class="text-sm overflow-x-auto text-neutral-800 dark:text-neutral-200"><code class="language-json">{{ formattedJson }}</code></pre>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  data: unknown
  highlightFields?: string[]
}>()

const copied = ref(false)

const formattedJson = computed(() => {
  return JSON.stringify(props.data, null, 2)
})

const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(formattedJson.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>
