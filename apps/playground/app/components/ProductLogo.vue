<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-lg"
    :style="{ background: SURFACE, border: `1px solid ${logo.accent}66` }"
    role="img"
    :aria-label="kind === 'auto-api' ? 'nuxt-auto-api' : 'nuxt-auto-admin'"
  >
    <svg
      class="w-[78%] overflow-visible"
      :viewBox="`0 0 ${logo.vb[0]} ${logo.vb[1]}`"
      aria-hidden="true"
    >
      <template
        v-for="(group, g) in logo.groups"
        :key="g"
      >
        <rect
          v-for="([x, y], i) in group.px"
          :key="i"
          :x="x"
          :y="y"
          width="1.5"
          height="1.5"
          :fill="group.fill"
        />
      </template>
    </svg>
  </span>
</template>

<script setup lang="ts">
// The nuxt-auto product marks: pixel art in the websideproject gradient (amber · pink · violet) on a dark tile.
// Size it from the outside (`class="size-8"`); the mark fills 78% of the tile's width.
type Kind = 'auto-api' | 'auto-admin'
type Px = [number, number]

const props = withDefaults(defineProps<{ kind?: Kind }>(), { kind: 'auto-api' })

const VIOLET = '#9e7aff'
const AMBER = '#ffbd7a'
const PINK = '#fe8bbb'
const GREEN = '#4ade80'
const SURFACE = '#14141e'

const LOGOS: Record<Kind, { vb: [number, number], accent: string, groups: { px: Px[], fill: string }[] }> = {
  // client (amber) ↔ server (violet), with request (green) and response (pink) arrows
  'auto-api': {
    vb: [20, 8],
    accent: VIOLET,
    groups: [
      { px: [[0, 0], [2, 0], [0, 2], [2, 2], [0, 4], [2, 4], [0, 6], [2, 6]], fill: AMBER },
      { px: [[16, 0], [18, 0], [16, 2], [18, 2], [16, 4], [18, 4], [16, 6], [18, 6]], fill: VIOLET },
      { px: [[5, 2], [7, 2], [9, 2], [11, 2], [12, 1], [13, 2], [12, 3]], fill: GREEN },
      { px: [[6, 5], [8, 5], [10, 5], [12, 5], [5, 4], [4, 5], [5, 6]], fill: PINK }
    ]
  },
  // a table: amber header, pink checkboxes, violet and amber rows
  'auto-admin': {
    vb: [20, 9],
    accent: AMBER,
    groups: [
      { px: [[0, 0], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0], [12, 0], [14, 0], [16, 0], [18, 0]], fill: AMBER },
      { px: [[0, 3], [0, 5], [0, 7]], fill: PINK },
      { px: [[3, 3], [5, 3], [7, 3], [9, 3], [11, 3], [13, 3], [15, 3], [17, 3]], fill: VIOLET },
      { px: [[3, 5], [5, 5], [7, 5], [9, 5], [11, 5]], fill: VIOLET },
      { px: [[3, 7], [5, 7], [7, 7], [9, 7], [11, 7], [13, 7], [15, 7], [17, 7]], fill: AMBER }
    ]
  }
}

const logo = computed(() => LOGOS[props.kind])
</script>
