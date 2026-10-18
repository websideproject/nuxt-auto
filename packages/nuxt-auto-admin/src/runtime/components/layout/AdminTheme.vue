<template>
  <!-- Renders nothing visible: it adds `autoAdmin.theme`'s stylesheet while the admin is open -->
  <span hidden />
</template>

<script setup lang="ts">
import { useHead } from '#app'
import { useAdminConfig } from '../../composables/useAdminConfig'
import { themeCss } from '../../utils/themeCss'

const css = themeCss(useAdminConfig().theme)
if (css) useHead({ style: [{ key: 'auto-admin-theme', innerHTML: css }] })
</script>
