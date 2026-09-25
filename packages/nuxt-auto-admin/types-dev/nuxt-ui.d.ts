// Dev-only typing for the package's own typecheck (not shipped — `files` is `dist`). In an app, Nuxt UI
// auto-imports `useToast`; the package's prepare context does not install Nuxt UI, so declare it here. Importing
// the runtime file instead would bypass Nuxt's transform and break the build (it imports `#imports` itself).
declare global {
  const useToast: typeof import('@nuxt/ui/composables/useToast')['useToast']
}
export {}
