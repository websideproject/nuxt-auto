<template>
  <DefineCalendar>
    <UPopover>
      <UButton
        color="neutral"
        variant="link"
        size="sm"
        icon="i-heroicons-calendar"
        aria-label="Open calendar"
        class="px-0"
      />
      <template #content>
        <div class="p-2">
          <UCalendar
            :model-value="calendarDateOnly"
            @update:model-value="handleCalendarPick"
          />
          <div
            v-if="showTime"
            class="flex items-center gap-2 mt-2 px-1"
          >
            <UInput
              type="number"
              :model-value="currentHour"
              min="0"
              max="23"
              class="w-16 text-center"
              placeholder="HH"
              @update:model-value="handleHourChange"
            />
            <span class="text-muted">:</span>
            <UInput
              type="number"
              :model-value="currentMinute"
              min="0"
              max="59"
              class="w-16 text-center"
              placeholder="MM"
              @update:model-value="handleMinuteChange"
            />
          </div>
        </div>
      </template>
    </UPopover>
  </DefineCalendar>

  <!-- With `format` ('DD/MM/YYYY', 'YYYY-MM-DD HH:mm'): a text input in that pattern -->
  <div
    v-if="format"
    class="w-full"
  >
    <UInput
      :model-value="text"
      :placeholder="placeholder || format"
      :disabled="readonly"
      :required="required"
      :color="invalid ? 'error' : undefined"
      :highlight="invalid"
      class="w-full"
      @update:model-value="text = String($event ?? '')"
      @blur="commitText"
      @keydown.enter.prevent="commitText"
    >
      <template #trailing>
        <ReuseCalendar />
      </template>
    </UInput>
    <p
      v-if="invalid"
      class="mt-1 text-sm text-error"
    >
      Use the format {{ format }}
    </p>
  </div>
  <UInputDate
    v-else
    ref="inputDateRef"
    :model-value="calendarValue"
    :granularity="showTime ? 'minute' : 'day'"
    :disabled="readonly"
    :required="required"
    class="w-full"
    @update:model-value="handleUpdate"
  >
    <template #trailing>
      <ReuseCalendar />
    </template>
  </UInputDate>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { CalendarDate, CalendarDateTime } from '@internationalized/date'
import { createReusableTemplate } from '@vueuse/core'
import type { WidgetOptions } from '../../types'
import { formatDate, formatHasTime, parseDate } from '../../utils/dateFormat'

const props = defineProps<{
  modelValue?: Date | string | null
  placeholder?: string
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Date | null]
}>()

const [DefineCalendar, ReuseCalendar] = createReusableTemplate()
const inputDateRef = useTemplateRef('inputDateRef')
const format = computed(() => props.options?.format)
const showTime = computed(() => props.options?.showTime ?? (format.value ? formatHasTime(format.value) : false))

// Text mode (`format`): the typed text is committed on blur / Enter; text that does not match stays, marked invalid.
const text = ref('')
const invalid = ref(false)
watch(() => [props.modelValue, format.value] as const, ([value, fmt]) => {
  if (!fmt) return
  const d = value ? new Date(value) : null
  text.value = d && !Number.isNaN(d.getTime()) ? formatDate(d, fmt) : ''
  invalid.value = false
}, { immediate: true })

function commitText() {
  if (!format.value) return
  if (!text.value.trim()) {
    invalid.value = false
    emit('update:modelValue', null)
    return
  }
  const parsed = parseDate(text.value, format.value)
  invalid.value = !parsed
  if (parsed) emit('update:modelValue', parsed)
}

const calendarValue = computed(() => {
  if (!props.modelValue) return undefined
  const d = new Date(props.modelValue)
  if (Number.isNaN(d.getTime())) return undefined
  if (showTime.value) {
    return new CalendarDateTime(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes())
  }
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
})

const calendarDateOnly = computed(() => {
  if (!props.modelValue) return undefined
  const d = new Date(props.modelValue)
  if (Number.isNaN(d.getTime())) return undefined
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
})

const currentHour = computed(() => {
  if (!props.modelValue) return 0
  const d = new Date(props.modelValue)
  return Number.isNaN(d.getTime()) ? 0 : d.getHours()
})

const currentMinute = computed(() => {
  if (!props.modelValue) return 0
  const d = new Date(props.modelValue)
  return Number.isNaN(d.getTime()) ? 0 : d.getMinutes()
})

function handleUpdate(value: CalendarDate | CalendarDateTime | null | undefined) {
  if (!value) {
    emit('update:modelValue', null)
    return
  }
  if ('hour' in value) {
    emit('update:modelValue', new Date(value.year, value.month - 1, value.day, value.hour, value.minute))
  }
  else {
    emit('update:modelValue', new Date(value.year, value.month - 1, value.day))
  }
}

function handleCalendarPick(value: CalendarDate | null | undefined) {
  if (!value) return
  if (showTime.value) {
    emit('update:modelValue', new Date(value.year, value.month - 1, value.day, currentHour.value, currentMinute.value))
  }
  else {
    emit('update:modelValue', new Date(value.year, value.month - 1, value.day))
  }
}

function handleHourChange(val: string | number) {
  const hour = Math.min(23, Math.max(0, Number(val) || 0))
  const cur = calendarDateOnly.value
  if (!cur) return
  emit('update:modelValue', new Date(cur.year, cur.month - 1, cur.day, hour, currentMinute.value))
}

function handleMinuteChange(val: string | number) {
  const minute = Math.min(59, Math.max(0, Number(val) || 0))
  const cur = calendarDateOnly.value
  if (!cur) return
  emit('update:modelValue', new Date(cur.year, cur.month - 1, cur.day, currentHour.value, minute))
}
</script>
