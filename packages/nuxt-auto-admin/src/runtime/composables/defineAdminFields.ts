import type { AdminFieldRules } from '../types'

/**
 * Field rules per resource, for the app's `admin.fields.ts` — the functions a form field can take, which
 * nuxt.config cannot carry:
 *
 * ```ts
 * export default defineAdminFields({
 *   articles: {
 *     publishedAt: { condition: form => !!form.published },
 *     slug: { validation: value => /^[a-z0-9-]+$/.test(String(value ?? '')) || 'Lowercase letters, digits and dashes' },
 *   },
 * })
 * ```
 */
export function defineAdminFields<T extends AdminFieldRules>(fields: T): T {
  return fields
}
