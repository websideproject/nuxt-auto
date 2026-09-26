import { describe, it, expect } from 'vitest'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import {
  getSoftDeleteColumn,
  getSoftDeleteCompanions,
  supportsSoftDelete,
  buildSoftDeleteUpdates,
  buildRestoreUpdates,
} from '../../../src/runtime/server/utils/softDelete'

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
        { softDelete: false },
      )
      expect(result).toBe(false)
    })

    it('should support array config with included resource', () => {
      const result = supportsSoftDelete(
        'posts',
        tableWithSoftDelete,
        { softDelete: ['posts', 'users'] },
      )
      expect(result).toBe(true)
    })

    it('should support array config with excluded resource', () => {
      const result = supportsSoftDelete(
        'comments',
        tableWithSoftDelete,
        { softDelete: ['posts', 'users'] },
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

// ── Real-drizzle detection: nullable vs NOT-NULL marker + companions ──────────
// The privacy `deleted_at` collision fix: a marker counts only when nullable OR a preset companion
// column is present, so a NOT-NULL domain `deleted_at` (privacy tombstones/erasures) is NOT detected.

const presetTable = sqliteTable('with_preset', {
  id: text('id').primaryKey(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  deletedBy: text('deleted_by'),
  deletionId: text('deletion_id'),
  deletedReason: text('deleted_reason'),
})

const nullableOnly = sqliteTable('nullable_only', {
  id: text('id').primaryKey(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), // nullable, no companions
})

const privacyLike = sqliteTable('privacy_like', {
  id: text('id').primaryKey(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }).notNull(), // domain col, NOT NULL, no companions
})

describe('getSoftDeleteColumn (real drizzle columns)', () => {
  it('detects the preset table (companion present)', () => {
    expect(getSoftDeleteColumn(presetTable)).toBe('deletedAt')
  })
  it('detects a nullable deleted_at without companions', () => {
    expect(getSoftDeleteColumn(nullableOnly)).toBe('deletedAt')
  })
  it('REJECTS a NOT-NULL deleted_at with no companions (privacy collision)', () => {
    expect(getSoftDeleteColumn(privacyLike)).toBeNull()
  })
})

describe('getSoftDeleteCompanions', () => {
  it('lists present companions', () => {
    expect(getSoftDeleteCompanions(presetTable).sort()).toEqual(['deletedBy', 'deletedReason', 'deletionId'].sort())
  })
  it('returns [] when none present', () => {
    expect(getSoftDeleteCompanions(nullableOnly)).toEqual([])
  })
})

describe('buildSoftDeleteUpdates / buildRestoreUpdates', () => {
  it('stamps marker + all present companions', () => {
    const u = buildSoftDeleteUpdates(presetTable, { deletionId: 'b1', reason: 'spam', userId: 'u1' })
    expect(u.deletedAt).toBeInstanceOf(Date)
    expect(u.deletedBy).toBe('u1')
    expect(u.deletionId).toBe('b1')
    expect(u.deletedReason).toBe('spam')
  })
  it('omits deletedReason when not provided', () => {
    const u = buildSoftDeleteUpdates(presetTable, { deletionId: 'b1', userId: 'u1' })
    expect('deletedReason' in u).toBe(false)
  })
  it('only stamps the marker when no companions exist', () => {
    const u = buildSoftDeleteUpdates(nullableOnly, { deletionId: 'b1', userId: 'u1' })
    expect(Object.keys(u)).toEqual(['deletedAt'])
  })
  it('restore clears marker + companions', () => {
    expect(buildRestoreUpdates(presetTable)).toEqual({ deletedAt: null, deletedBy: null, deletionId: null, deletedReason: null })
  })
})
