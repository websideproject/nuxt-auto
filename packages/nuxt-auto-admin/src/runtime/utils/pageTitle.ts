import type { CustomPageConfig } from '../types'

interface TitleResource { displayName: string, singularName: string }

/**
 * The browser-tab title of an admin page, from its path: "Dashboard", "Articles", "Create Article",
 * "Article #7", "Edit Article #7", or a custom page's label. `undefined` for a path it does not know (the page's
 * own `useHead` title, if any, is used then).
 */
export function adminPageTitle(
  path: string,
  prefix: string,
  getResource: (name: string) => TitleResource | undefined,
  customPages: CustomPageConfig[] = [],
): string | undefined {
  const base = prefix.replace(/\/+$/, '')
  if (path !== base && !path.startsWith(`${base}/`)) return undefined
  const segments = path.slice(base.length).split('/').filter(Boolean).map(decodeURIComponent)
  if (segments.length === 0) return 'Dashboard'

  const custom = customPages.find(p => p.path.replace(/^\/+/, '') === segments.join('/') || p.path === path)
  if (custom) return custom.label

  const resource = getResource(segments[0]!)
  if (!resource) return undefined
  const [, id, action] = segments
  if (id === undefined) return resource.displayName
  if (id === 'new' && action === undefined) return `Create ${resource.singularName}`
  if (action === 'edit') return `Edit ${resource.singularName} #${id}`
  if (action === undefined) return `${resource.singularName} #${id}`
  return resource.displayName
}
