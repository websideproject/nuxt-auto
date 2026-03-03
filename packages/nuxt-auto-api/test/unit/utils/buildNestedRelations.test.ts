import { describe, it, expect, vi } from 'vitest'
import { buildNestedRelations, parseEnhancedInclude } from '../../../src/runtime/server/utils/buildNestedRelations'

// Stub useRuntimeConfig
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {},
  autoApi: {
    relations: {
      maxDepth: 3
    }
  }
}))

describe('buildNestedRelations Utils', () => {
  describe('parseEnhancedInclude', () => {
    it('should parse relation name', () => {
      const result = parseEnhancedInclude('posts')
      expect(result.relation).toBe('posts')
    })

    it('should parse field selection', () => {
      const result = parseEnhancedInclude('posts[id,title]')
      expect(result.relation).toBe('posts')
      expect(result.fields).toEqual(['id', 'title'])
    })

    it('should parse options', () => {
      const result = parseEnhancedInclude('posts{limit:10}')
      expect(result.relation).toBe('posts')
      expect(result.options).toEqual({ limit: 10 })
    })

    it('should parse combined syntax', () => {
      const result = parseEnhancedInclude('posts[id,title]{limit:10}')
      expect(result.relation).toBe('posts')
      expect(result.fields).toEqual(['id', 'title'])
      expect(result.options).toEqual({ limit: 10 })
    })

    it('should parse nested relation string', () => {
      const result = parseEnhancedInclude('posts.comments')
      expect(result.relation).toBe('posts')
      expect(result.nested).toBe('comments')
    })
  })

  describe('buildNestedRelations', () => {
    const mockSchema = {
      posts: {}, // Mock table
      comments: {},
      author: {}
    }

    it('should build simple relation', () => {
      const result = buildNestedRelations(['posts'], mockSchema)
      expect(result).toEqual({
        posts: {}
      })
    })

    it('should build relation with field selection using columns', () => {
      const result = buildNestedRelations(['posts[id,title]'], mockSchema)
      expect(result).toEqual({
        posts: {
          columns: {
            id: true,
            title: true
          }
        }
      })
    })

    it('should build relation with limit', () => {
      const result = buildNestedRelations(['posts{limit:10}'], mockSchema)
      expect(result).toEqual({
        posts: {
          limit: 10
        }
      })
    })

    it('should build nested relation', () => {
      const result = buildNestedRelations(['posts.comments'], mockSchema)
      expect(result).toEqual({
        posts: {
          with: {
            comments: {}
          }
        }
      })
    })

    it('should build nested relation with fields at multiple levels', () => {
      const result = buildNestedRelations(['posts[id,title].comments[id,body]'], mockSchema)
      
      expect(result).toEqual({
        posts: {
          columns: {
            id: true,
            title: true
          },
          with: {
            comments: {
              columns: {
                id: true,
                body: true
              }
            }
          }
        }
      })
    })

    it('should NOT use _selectFields metadata anymore', () => {
      const result = buildNestedRelations(['posts[id,title]'], mockSchema)
      expect(result?.posts).not.toHaveProperty('_selectFields')
    })
  })
})
