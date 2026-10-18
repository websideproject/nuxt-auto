<template>
  <div
    v-if="editorAvailable"
    class="w-full rounded-md border border-default"
  >
    <component
      :is="Editor"
      v-slot="{ editor }"
      :model-value="modelValue ?? ''"
      :content-type="contentType"
      :placeholder="placeholder"
      :editable="!readonly"
      class="min-h-40 px-3 py-2"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <component
        :is="EditorToolbar"
        v-if="!readonly"
        :editor="editor"
        :items="items"
        class="border-b border-default -mx-3 -mt-2 mb-2 px-2 py-1 overflow-x-auto"
      />
    </component>
  </div>
  <!-- Nuxt UI before 4.3 has no editor: a plain textarea -->
  <UTextarea
    v-else
    :model-value="modelValue ?? ''"
    :placeholder="placeholder"
    :disabled="readonly"
    :required="required"
    :rows="8"
    autoresize
    class="w-full"
    @update:model-value="$emit('update:modelValue', String($event ?? ''))"
  />
</template>

<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import type { WidgetOptions } from '../../types'
import { toolbarItems } from '../../utils/widgetValues'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
  /** `html` (RichTextEditor) or `markdown` (MarkdownEditor) — what the column stores. */
  contentType?: 'html' | 'markdown'
}>(), { contentType: 'html' })

defineEmits<{
  'update:modelValue': [value: string]
}>()

const Editor = resolveComponent('UEditor')
const EditorToolbar = resolveComponent('UEditorToolbar')
const editorAvailable = typeof Editor !== 'string'
if (!editorAvailable) console.warn(`[nuxt-auto-admin] The ${props.contentType === 'markdown' ? 'Markdown' : 'RichText'}Editor widget needs @nuxt/ui 4.3 or later (UEditor); showing a textarea.`)

const items = computed(() => toolbarItems(props.options?.toolbar))
</script>
