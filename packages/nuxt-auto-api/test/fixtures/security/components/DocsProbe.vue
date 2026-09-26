<script setup lang="ts">
// NOT awaited, and rendered before LabelsProbe, whose await holds the render open: this query always finishes
// mid-render, after this component rendered its loading state. Its data must not be shipped
// (test/security.test.ts › "SSR").
const { data } = useAutoApiList('docs')
</script>

<template>
  <p id="docs-state">
    {{ data ? 'loaded' : 'loading' }}
  </p>
</template>
