<script setup lang="ts">
// SSR probe for the composables: the list is awaited on the server with the caller's headers and shipped to
// the client in the payload (test/security.test.ts › "SSR").
const { data, error, suspense } = useAutoApiList('labels', { sort: 'name' })
await suspense().catch(() => {})
</script>

<template>
  <div>
    <ul id="labels">
      <li v-for="label in data?.data ?? []" :key="label.id">
        {{ label.name }}
      </li>
    </ul>
    <p v-if="error" id="error">
      {{ (error as any).statusCode }}
    </p>
  </div>
</template>
