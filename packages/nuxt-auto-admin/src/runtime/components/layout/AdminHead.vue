<template>
  <!-- Renders nothing visible: it sets the browser tab's title and favicon -->
  <span hidden />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useHead, useRoute } from '#app'
import { adminPageTitle } from '../../utils/pageTitle'
import { useAdminConfig } from '../../composables/useAdminConfig'
import { useAdminRegistry } from '../../composables/useAdminRegistry'

// "<page> · <branding.title>" and `branding.favicon`. A page that sets its own title (useHead) wins.
const { branding, prefix, customPages } = useAdminConfig()
const { getResource } = useAdminRegistry()
const route = useRoute()
const brand = branding.title || 'Admin Panel'
const pageTitle = computed(() => adminPageTitle(route.path, prefix, getResource, customPages))

useHead({
  title: pageTitle,
  titleTemplate: (title?: string) => (title ? `${title} · ${brand}` : brand),
  link: branding.favicon ? [{ rel: 'icon', href: branding.favicon, key: 'icon' }] : [],
})
</script>
