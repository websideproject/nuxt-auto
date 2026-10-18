import type { ThemeConfig } from '../types'

// How much of the color each shade keeps, mixed with white (lighter shades) or black (darker ones).
const SHADES: Array<[number, string]> = [
  [50, 'white 92%'], [100, 'white 84%'], [200, 'white 68%'], [300, 'white 50%'], [400, 'white 25%'],
  [600, 'black 15%'], [700, 'black 30%'], [800, 'black 45%'], [900, 'black 58%'], [950, 'black 70%'],
]

/** A CSS color the theme accepts: no characters that could end the declaration or the rule. */
function safeColor(color: string): string | undefined {
  const value = color.trim()
  return value && !/[;{}<>]/.test(value) ? value : undefined
}

/**
 * The stylesheet `autoAdmin.theme` adds while the admin is open: `primaryColor` (a CSS color — `#4f46e5`,
 * `oklch(…)`) becomes Nuxt UI's primary scale, shades mixed from it, for the admin and its modals; `customCss` follows
 * as given. Empty when the theme sets neither.
 */
export function themeCss(theme: ThemeConfig | undefined): string {
  const parts: string[] = []
  const color = theme?.primaryColor ? safeColor(theme.primaryColor) : undefined
  if (color) {
    const scale = SHADES.map(([shade, mix]) => `--ui-color-primary-${shade}: color-mix(in oklch, ${color}, ${mix});`)
    // `:has()` scopes it to pages showing the admin, teleported modals included
    parts.push(`html:has([data-auto-admin]) { --ui-color-primary-500: ${color}; ${scale.join(' ')} --ui-primary: var(--ui-color-primary-500); }`)
    parts.push(`html.dark:has([data-auto-admin]) { --ui-primary: var(--ui-color-primary-400); }`)
  }
  if (theme?.customCss) parts.push(theme.customCss)
  return parts.join('\n')
}
