<template>
  <UInputDate
    ref="inputDateRef"
    :model-value="calendarValue"
    :granularity="showTime ? 'minute' : 'day'"
    :disabled="readonly"
    :required="required"
    class="w-full"
    @update:model-value="handleUpdate"
  >
    <template #trailing>
      <UPopover>
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-calendar"
          aria-label="Open calendar"
          class="px-0"
        />
        <template #content>
          <div class="p-2">
            <UCalendar
              :model-value="calendarDateOnly"
              @update:model-value="handleCalendarPick"
            />
            <div v-if="showTime" class="flex items-center gap-2 mt-2 px-1">
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
    </template>
  </UInputDate>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { CalendarDate, CalendarDateTime } from '@internationalized/date'
import type { WidgetOptions } from '../../types'

const props = defineProps<{
  modelValue?: Date | string | null
  readonly?: boolean
  required?: boolean
  options?: WidgetOptions
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Date | null]
}>()

const inputDateRef = useTemplateRef('inputDateRef')
const showTime = computed(() => props.options?.showTime ?? false)

const calendarValue = computed(() => {
  if (!props.modelValue) return undefined
  const d = new Date(props.modelValue)
  if (isNaN(d.getTime())) return undefined
  if (showTime.value) {
    return new CalendarDateTime(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes())
  }
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
})

const calendarDateOnly = computed(() => {
  if (!props.modelValue) return undefined
  const d = new Date(props.modelValue)
  if (isNaN(d.getTime())) return undefined
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
})

const currentHour = computed(() => {
  if (!props.modelValue) return 0
  const d = new Date(props.modelValue)
  return isNaN(d.getTime()) ? 0 : d.getHours()
})

const currentMinute = computed(() => {
  if (!props.modelValue) return 0
  const d = new Date(props.modelValue)
  return isNaN(d.getTime()) ? 0 : d.getMinutes()
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
