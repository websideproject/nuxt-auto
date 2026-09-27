<script setup>
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Nuxt Auto API - Interactive Demo'
const description = 'Explore the nuxt-auto-api permission system with interactive role switching. See how authorization works at operation, object, and field levels.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary'
})

// Initialize auth session on mount
const { fetchSession } = useAuth()
onMounted(() => {
  fetchSession()
})
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
          aria-label="Nuxt Auto playground"
        >
          <AppLogo />
        </NuxtLink>
      </template>

      <template #right>
        <DemoRoleSwitcher />

        <UColorModeButton />

        <UButton
          to="https://github.com/websideproject/nuxt-auto"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
          class="hidden sm:inline-flex"
        />
      </template>
    </UHeader>

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <USeparator>
      <ProductLogo
        kind="auto-admin"
        class="size-6"
      />
    </USeparator>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          Nuxt Auto playground · by <ColourfulText class="font-semibold" /> · © {{ new Date().getFullYear() }}
        </p>
      </template>

      <template #right>
        <UButton
          to="https://github.com/websideproject/nuxt-auto"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UFooter>
  </UApp>
</template>
