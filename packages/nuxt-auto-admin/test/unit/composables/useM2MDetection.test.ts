import { describe, it, expect } from 'vitest'
import { useM2MDetection } from '../../../src/runtime/composables/useM2MDetection'
import type { FieldConfig } from '../../../src/runtime/types'

describe('useM2MDetection', () => {
  const { mergeM2MFields, formatLabel } = useM2MDetection()

  // ─── formatLabel ─────────────────────────────────────────────────────────────

  describe('formatLabel', () => {
    it('converts camelCase resource names to Title Case', () => {
      expect(formatLabel('categories')).toBe('Categories')
      expect(formatLabel('articleCategories')).toBe('Article Categories')
      expect(formatLabel('blogTags')).toBe('Blog Tags')
    })

    it('converts snake_case to Title Case', () => {
      expect(formatLabel('article_tags')).toBe('Article Tags')
      expect(formatLabel('user_roles')).toBe('User Roles')
    })

    it('handles single words', () => {
      expect(formatLabel('tags')).toBe('Tags')
      expect(formatLabel('users')).toBe('Users')
    })
  })

  // ─── mergeM2MFields ───────────────────────────────────────────────────────────

  describe('mergeM2MFields', () => {
    const autoDetected = [
      {
        name: 'categories',
        label: 'Categories',
        widget: 'MultiRelationSelect' as const,
        options: { resource: 'categories', displayField: 'name' },
      },
      {
        name: 'tags',
        label: 'Tags',
        widget: 'MultiRelationSelect' as const,
        options: { resource: 'tags', displayField: 'name' },
      },
    ]

    it('returns auto-detected fields when no manual config', () => {
      const result = mergeM2MFields(autoDetected)
      expect(result).toHaveLength(2)
      expect(result.map(f => f.name)).toEqual(['categories', 'tags'])
    })

    it('manual config takes precedence over auto-detected fields with the same name', () => {
      const manualConfig: FieldConfig[] = [
        {
          name: 'categories',
          label: 'Custom Categories Label',
          widget: 'MultiRelationSelect',
          options: { resource: 'categories', displayField: 'title' },
        } as any,
      ]

      const result = mergeM2MFields(autoDetected, manualConfig)

      const categoriesField = result.find(f => f.name === 'categories')
      expect(categoriesField?.label).toBe('Custom Categories Label')
    })

    it('appends auto-detected fields not in manual config', () => {
      const manualConfig: FieldConfig[] = [
        {
          name: 'categories',
          label: 'Custom Categories Label',
          widget: 'MultiRelationSelect',
          options: { resource: 'categories', displayField: 'title' },
        } as any,
      ]

      const result = mergeM2MFields(autoDetected, manualConfig)

      // Manual categories + auto-detected tags
      expect(result).toHaveLength(2)
      expect(result.find(f => f.name === 'tags')).toBeDefined()
    })

    it('returns empty array when both inputs are empty', () => {
      expect(mergeM2MFields([])).toEqual([])
      expect(mergeM2MFields([], [])).toEqual([])
    })

    it('returns manual config as-is when no auto-detected fields', () => {
      const manualConfig: FieldConfig[] = [
        { name: 'roles', label: 'Roles', widget: 'MultiRelationSelect' } as any,
      ]

      const result = mergeM2MFields([], manualConfig)
      expect(result).toEqual(manualConfig)
    })

    it('preserves order: manual fields first, then auto-detected additions', () => {
      const manualConfig: FieldConfig[] = [
        { name: 'categories', label: 'C', widget: 'MultiRelationSelect' } as any,
      ]

      const result = mergeM2MFields(autoDetected, manualConfig)
      expect(result[0].name).toBe('categories') // manual first
      expect(result[1].name).toBe('tags')        // auto-detected appended
    })
  })
})
