<template>
  <div class="w-full space-y-2">
    <!-- The current file -->
    <div
      v-if="modelValue"
      class="flex items-center gap-3"
    >
      <img
        v-if="image"
        :src="modelValue"
        alt=""
        class="h-20 w-20 rounded-md object-cover border border-default"
      >
      <UIcon
        v-else
        name="i-heroicons-document"
        class="size-5 text-muted"
      />
      <a
        :href="modelValue"
        target="_blank"
        rel="noopener"
        class="text-sm text-primary truncate"
      >{{ fileName }}</a>
      <UButton
        v-if="canUpload"
        icon="i-heroicons-trash"
        color="error"
        variant="ghost"
        size="sm"
        :loading="busy"
        aria-label="Remove file"
        @click="remove"
      />
    </div>

    <UFileUpload
      v-if="canUpload"
      :model-value="null"
      :accept="accept"
      :label="image ? 'Drop an image here' : 'Drop a file here'"
      :description="maxSize ? `Up to ${String(options?.maxSize)}` : undefined"
      :icon="image ? 'i-heroicons-photo' : 'i-heroicons-arrow-up-tray'"
      :disabled="busy"
      layout="list"
      class="w-full min-h-28"
      @update:model-value="upload"
    />
    <p
      v-else-if="!readonly"
      class="text-sm text-muted"
    >
      Save the record first, then upload the file.
    </p>

    <p
      v-if="error"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNuxtApp } from '#app'
import { useAutoApiPath } from '@websideproject/nuxt-auto-api/composables'
import type { WidgetOptions } from '../../types'
import { apiErrorMessage } from '../../utils/apiErrors'
import { parseByteSize } from '../../utils/widgetValues'

const props = defineProps<{
  modelValue?: string | null
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
  /** ImageUpload: an image preview and `accept` defaulting to images. */
  image?: boolean
  fieldName?: string
  resourceName?: string
  recordId?: string | number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

// Files go through createFileUploadPlugin's route (POST / DELETE /api/{resource}/:id/upload), which stores one
// file per record in the column configured for the resource — so the record must exist first.
const apiPath = useAutoApiPath()
const nuxtApp = useNuxtApp()
const busy = ref(false)
const error = ref<string | null>(null)

const canUpload = computed(() => !props.readonly && !!props.resourceName && props.recordId !== undefined && props.recordId !== null)
const accept = computed(() => props.options?.accept || (props.image ? 'image/*' : undefined))
const maxSize = computed(() => parseByteSize(props.options?.maxSize))
const fileName = computed(() => decodeURIComponent(String(props.modelValue).split('/').pop() || String(props.modelValue)))

async function send(method: 'POST' | 'DELETE', body?: FormData) {
  busy.value = true
  error.value = null
  try {
    const res = await $fetch<{ data: Record<string, unknown> }>(apiPath(props.resourceName!, props.recordId!, 'upload'), { method, body })
    emit('update:modelValue', (res.data?.[props.fieldName!] as string | null | undefined) ?? null)
    await (nuxtApp.$queryClient as { invalidateQueries: (f: { queryKey: unknown[] }) => Promise<void> } | undefined)
      ?.invalidateQueries({ queryKey: ['autoapi', props.resourceName] })
  }
  catch (e) {
    error.value = apiErrorMessage(e)
  }
  finally {
    busy.value = false
  }
}

function upload(file: File | File[] | null | undefined) {
  const picked = Array.isArray(file) ? file[0] : file
  if (!picked) return
  if (maxSize.value && picked.size > maxSize.value) {
    error.value = `The file is larger than ${String(props.options?.maxSize)}`
    return
  }
  const body = new FormData()
  body.append('file', picked)
  send('POST', body)
}

function remove() {
  send('DELETE')
}
</script>
