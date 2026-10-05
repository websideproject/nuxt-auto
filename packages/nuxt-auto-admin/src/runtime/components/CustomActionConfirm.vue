<template>
  <UModal
    :open="state.open"
    :title="state.action?.label"
    @update:open="(open: boolean) => { if (!open) emit('cancel') }"
  >
    <template #body>
      <p class="text-sm text-toned">
        {{ state.message }}
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          variant="ghost"
          color="neutral"
          :disabled="state.running"
          @click="emit('cancel')"
        >
          Cancel
        </UButton>
        <UButton
          :color="state.action?.color ?? 'primary'"
          :icon="state.action?.icon"
          :loading="state.running"
          data-testid="admin-action-confirm"
          @click="emit('confirm')"
        >
          {{ state.action?.label }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ResolvedAction } from '../utils/customActions'

defineProps<{
  /** `pending` from useAdminCustomActions */
  state: { open: boolean, running: boolean, message: string, action: ResolvedAction | null }
}>()
const emit = defineEmits<{ confirm: [], cancel: [] }>()
</script>
