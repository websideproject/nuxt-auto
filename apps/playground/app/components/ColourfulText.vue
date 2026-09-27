<template>
  <span :aria-label="text"><span
    v-for="(char, i) in text"
    :key="i"
    aria-hidden="true"
    :style="{ color: colorAt(i) }"
  >{{ char }}</span></span>
</template>

<script setup lang="ts">
// The websideproject wordmark: each letter a step along the amber → pink → violet gradient. Static.
const props = withDefaults(defineProps<{ text?: string, colors?: [number, number, number][] }>(), {
  text: 'websideproject',
  colors: () => [[255, 189, 122], [254, 139, 187], [158, 122, 255]]
})

function colorAt(i: number): string {
  const steps = Math.max(props.text.length - 1, 1)
  const segments = props.colors.length - 1
  const t = (i / steps) * segments
  const k = Math.min(Math.floor(t), segments - 1)
  const f = t - k
  const [a, b] = [props.colors[k]!, props.colors[k + 1]!]
  const mix = (n: number) => Math.round(a[n]! + (b[n]! - a[n]!) * f)
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`
}
</script>
