/**
 * The hook calls `modules/base/hooks.ts` recorded, newest first (`DELETE` clears them) — the activity feed of
 * /demo/hooks.
 */
const store = globalThis as { __playgroundHookLog?: unknown[] }

export default defineEventHandler((event) => {
  if (event.method === 'DELETE') store.__playgroundHookLog = []
  return { data: store.__playgroundHookLog ?? [] }
})
