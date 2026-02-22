<template>
  <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">API Response</span>
      <UButton
        :icon="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
        size="xs"
        color="gray"
        variant="ghost"
        @click="copyJson"
      />
    </div>
    <pre class="text-sm overflow-x-auto"><code class="language-json">{{ formattedJson }}</code></pre>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  data: any
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

<style scoped>
code {
  color: #d4d4d4;
}

/* JSON syntax highlighting using simple regex-based approach */
:deep(.language-json) {
  color: #d4d4d4;
}
</style>
