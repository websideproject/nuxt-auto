/**
 * The client composables auto-imported when `autoApi.vueQuery` is `false` — the ones that import nothing from
 * `@tanstack/vue-query`, directly or through a sibling. Everything else in `composables/` needs it.
 * `test/unit/vueQueryFreeComposables.test.ts` checks they stay free of it.
 */
export const VUE_QUERY_FREE_COMPOSABLES = [
  { name: 'useAutoApiFetch', file: 'autoApiFetch' },
  { name: 'useAutoApiPath', file: 'autoApiPath' },
] as const
