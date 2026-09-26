// Dev-only typing for the package's own typecheck (not shipped — `files` is `dist`). In an app, Nuxt UI registers
// `useToast` in `#imports`; the package's prepare context does not install Nuxt UI, so declare it here.
// (Import it from '#imports', not from the @nuxt/ui runtime file: that file imports `#imports` itself and must go
// through the app's transform. Nor rely on auto-import: Nuxt does not auto-import into node_modules.)
declare module '#imports' {
  export const useToast: typeof import('@nuxt/ui/composables/useToast')['useToast']
}
export {}
