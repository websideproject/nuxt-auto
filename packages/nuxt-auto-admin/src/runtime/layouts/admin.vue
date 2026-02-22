<template>
  <div class="flex h-full bg-gray-50/50 dark:bg-gray-950 overflow-hidden">
    <AdminSidebar />

    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <AdminHeader />

      <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div class="max-w-[1600px] mx-auto">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
// Layout wrapper with responsive design and dark mode support
</script>
