<template>
  <div class="space-y-4">
    <div
      v-for="(row, index) in rows"
      :key="index"
      class="flex items-end gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
    >
      <div class="flex-1 grid gap-3" :style="{ gridTemplateColumns: `repeat(${fields.length}, 1fr)` }">
        <div v-for="field in fields" :key="field.name">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ field.label }}
          </label>
          <UInput
            v-model="row[field.name]"
            :type="field.type || 'text'"
            :placeholder="field.placeholder"
            size="md"
          />
        </div>
      </div>
      <UButton
        icon="i-heroicons-trash"
        color="error"
        variant="ghost"
        size="md"
        @click="removeRow(index)"
        :disabled="rows.length === 1"
      />
    </div>

    <div class="flex gap-2">
      <UButton
        icon="i-heroicons-plus"
        label="Add Row"
        color="gray"
        variant="outline"
        size="sm"
        @click="addRow"
      />
      <UButton
        :label="submitLabel"
        color="green"
        size="sm"
        :loading="loading"
        @click="handleSubmit"
        :disabled="!isValid"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface FieldDefinition {
  name: string
  label: string
  type?: string
  placeholder?: string
  required?: boolean
}

const props = withDefaults(
  defineProps<{
    fields: FieldDefinition[]
    initialRows?: number
    submitLabel?: string
    loading?: boolean
  }>(),
  {
    initialRows: 3,
    submitLabel: 'Submit',
    loading: false
  }
)

const emit = defineEmits<{
  submit: [data: Record<string, any>[]]
}>()

const rows = ref<Record<string, any>[]>([])

const initializeRows = () => {
  rows.value = Array.from({ length: props.initialRows }, () => {
    const row: Record<string, any> = {}
    props.fields.forEach(field => {
      row[field.name] = ''
    })
    return row
  })
}

const addRow = () => {
  const newRow: Record<string, any> = {}
  props.fields.forEach(field => {
    newRow[field.name] = ''
  })
  rows.value.push(newRow)
}

const removeRow = (index: number) => {
  if (rows.value.length > 1) {
    rows.value.splice(index, 1)
  }
}

const isValid = computed(() => {
  return rows.value.every(row => {
    return props.fields.every(field => {
      if (field.required !== false) {
        return row[field.name] && row[field.name].toString().trim() !== ''
      }
      return true
    })
  })
})

const handleSubmit = () => {
  if (isValid.value) {
    emit('submit', rows.value)
  }
}

// Initialize rows on mount
onMounted(() => {
  initializeRows()
})

// Expose method to reset form
defineExpose({
  reset: initializeRows
})
</script>
