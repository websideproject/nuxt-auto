<template>
  <div class="relative group">
    <div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <UButton
        :icon="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
        size="xs"
        color="gray"
        variant="solid"
        @click="copyCode"
      />
    </div>
    <pre
      class="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm"
    ><code :class="`language-${language}`">{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    code: string
    language?: string
  }>(),
  {
    language: 'typescript'
  }
)

const copied = ref(false)

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>
