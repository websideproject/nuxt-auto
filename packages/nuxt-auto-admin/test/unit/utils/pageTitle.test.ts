import { describe, it, expect } from 'vitest'
import { adminPageTitle } from '../../../src/runtime/utils/pageTitle'

const resources: Record<string, { displayName: string, singularName: string }> = {
  articles: { displayName: 'Articles', singularName: 'Article' },
}
const title = (path: string) => adminPageTitle(path, '/admin', name => resources[name], [{ name: 'reports', label: 'Reports', path: 'reports', icon: 'x' }])

describe('adminPageTitle', () => {
  it('names each admin page', () => {
    expect(title('/admin')).toBe('Dashboard')
    expect(title('/admin/articles')).toBe('Articles')
    expect(title('/admin/articles/new')).toBe('Create Article')
    expect(title('/admin/articles/7')).toBe('Article #7')
    expect(title('/admin/articles/7/edit')).toBe('Edit Article #7')
    expect(title('/admin/reports')).toBe('Reports')
  })

  it('knows nothing outside the admin or of unknown resources', () => {
    expect(title('/blog')).toBeUndefined()
    expect(title('/administrator')).toBeUndefined()
    expect(title('/admin/nope')).toBeUndefined()
  })
})
