import { describe, it, expect } from 'vitest'
import { getSoftDeleteColumn, supportsSoftDelete } from '../../../src/runtime/server/utils/softDelete'

describe('softDelete utilities', () => {
  describe('getSoftDeleteColumn', () => {
    it('should detect deletedAt column', () => {
      const table = {
        id: Symbol('id'),
        name: Symbol('name'),
        deletedAt: Symbol('deletedAt'),
      }

      const column = getSoftDeleteColumn(table)
      expect(column).toBe('deletedAt')
    })

    it('should detect deleted_at column', () => {
      const table = {
        id: Symbol('id'),
        name: Symbol('name'),
        deleted_at: Symbol('deleted_at'),
      }

      const column = getSoftDeleteColumn(table)
      expect(column).toBe('deleted_at')
    })

    it('should detect deletedDate column', () => {
      const table = {
        id: Symbol('id'),
        name: Symbol('name'),
        deletedDate: Symbol('deletedDate'),
      }

      const column = getSoftDeleteColumn(table)
      expect(column).toBe('deletedDate')
    })

    it('should return null if no soft delete column exists', () => {
      const table = {
        id: Symbol('id'),
        name: Symbol('name'),
        createdAt: Symbol('createdAt'),
      }

      const column = getSoftDeleteColumn(table)
      expect(column).toBeNull()
    })

    it('should prioritize deletedAt over other variants', () => {
      const table = {
        id: Symbol('id'),
        deletedAt: Symbol('deletedAt'),
        deleted_at: Symbol('deleted_at'),
        deletedDate: Symbol('deletedDate'),
      }

      const column = getSoftDeleteColumn(table)
      expect(column).toBe('deletedAt')
    })

    it('should return null for null/undefined table', () => {
      expect(getSoftDeleteColumn(null)).toBeNull()
      expect(getSoftDeleteColumn(undefined)).toBeNull()
    })

    it('should return null for empty table', () => {
      const table = {}
      const column = getSoftDeleteColumn(table)
      expect(column).toBeNull()
    })
  })

  describe('supportsSoftDelete', () => {
    const tableWithSoftDelete = {
      id: Symbol('id'),
      name: Symbol('name'),
      deletedAt: Symbol('deletedAt'),
    }

    const tableWithoutSoftDelete = {
      id: Symbol('id'),
      name: Symbol('name'),
    }

    it('should return true for table with deletedAt', () => {
      const result = supportsSoftDelete('posts', tableWithSoftDelete)
      expect(result).toBe(true)
    })

    it('should return false for table without soft delete column', () => {
      const result = supportsSoftDelete('posts', tableWithoutSoftDelete)
      expect(result).toBe(false)
    })

    it('should respect explicit false config', () => {
      const result = supportsSoftDelete(
        'posts',
        tableWithSoftDelete,
        { softDelete: false }
      )
      expect(result).toBe(false)
    })

    it('should support array config with included resource', () => {
      const result = supportsSoftDelete(
        'posts',
        tableWithSoftDelete,
        { softDelete: ['posts', 'users'] }
      )
      expect(result).toBe(true)
    })

    it('should support array config with excluded resource', () => {
      const result = supportsSoftDelete(
        'comments',
        tableWithSoftDelete,
        { softDelete: ['posts', 'users'] }
      )
      expect(result).toBe(false)
    })

    it('should auto-detect when config is undefined', () => {
      const result = supportsSoftDelete('posts', tableWithSoftDelete, undefined)
      expect(result).toBe(true)
    })

    it('should auto-detect when config is empty object', () => {
      const result = supportsSoftDelete('posts', tableWithSoftDelete, {})
      expect(result).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle table with only soft delete column', () => {
      const table = {
        deletedAt: Symbol('deletedAt'),
      }

      const column = getSoftDeleteColumn(table)
      expect(column).toBe('deletedAt')
    })

    it('should handle resource name case sensitivity', () => {
      const table = {
        id: Symbol('id'),
        deletedAt: Symbol('deletedAt'),
      }

      const result1 = supportsSoftDelete('Posts', table)
      const result2 = supportsSoftDelete('posts', table)

      expect(result1).toBe(true)
      expect(result2).toBe(true)
    })

    it('should handle special resource names', () => {
      const table = {
        id: Symbol('id'),
        deletedAt: Symbol('deletedAt'),
      }

      const result = supportsSoftDelete('user-profiles', table)
      expect(result).toBe(true)
    })
  })
})
