/**
 * Initialize global hook registry
 * This plugin runs early to ensure __autoApiHooks is available
 * for other plugins to register hooks
 */
export default defineNitroPlugin(() => {
  // Initialize global hook registry if not already present
  if (!(globalThis as any).__autoApiHooks) {
    (globalThis as any).__autoApiHooks = {}
    console.log('[autoApi] Initialized global hook registry')
  }
})
