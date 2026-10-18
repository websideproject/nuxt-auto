/**
 * The hook calls `modules/base/hooks.ts` recorded for this browser (its `hook-feed` cookie), newest first — the
 * activity feed of /demo/hooks.
 */
const store = globalThis as { __playgroundHookLog?: Array<{ feed?: string }> }

export default defineEventHandler((event) => {
  const feed = getCookie(event, 'hook-feed')
  return { data: feed ? (store.__playgroundHookLog ?? []).filter(entry => entry.feed === feed).slice(0, 50) : [] }
})
