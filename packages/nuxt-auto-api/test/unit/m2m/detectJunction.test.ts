import { describe, it, expect } from 'vitest'
import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core'
import { detectJunction, validateJunctionConfig } from '../../../src/runtime/server/utils/m2m/detectJunction'
import { detectAllJunctionTables, getM2MRelationshipsForResource } from '../../../src/runtime/server/utils/m2m/detectJunctions'

// Test schema setup
const articles = sqliteTable('articles', {
  id: integer('id').primaryKey(),
  title: text('title'),
})

const categories = sqliteTable('categories', {
  id: integer('id').primaryKey(),
  name: text('name'),
})

const tags = sqliteTable('tags', {
  id: integer('id').primaryKey(),
  name: text('name'),
})

// Junction table: standard camelCase pattern
const articleCategories = sqliteTable('articleCategories', {
  articleId: integer('articleId').notNull().references(() => articles.id),
  categoryId: integer('categoryId').notNull().references(() => categories.id),
  sortOrder: integer('sortOrder'), // metadata column
}, table => ({
  pk: primaryKey({ columns: [table.articleId, table.categoryId] }),
}))

// Junction table: snake_case pattern
const article_tags = sqliteTable('article_tags', {
  article_id: integer('article_id').notNull().references(() => articles.id),
  tag_id: integer('tag_id').notNull().references(() => tags.id),
}, table => ({
  pk: primaryKey({ columns: [table.article_id, table.tag_id] }),
}))

// Junction table: reversed naming (categoriesArticles)
const categoriesArticles = sqliteTable('categoriesArticles', {
  categoryId: integer('categoryId').notNull().references(() => categories.id),
  articleId: integer('articleId').notNull().references(() => articles.id),
}, table => ({
  pk: primaryKey({ columns: [table.categoryId, table.articleId] }),
}))

const testSchema = {
  articles,
  categories,
  tags,
  articleCategories,
  article_tags,
  categoriesArticles,
}

describe('detectJunction', () => {
  describe('Auto-detection with naming patterns', () => {
    it('should detect junction table with camelCase pattern (articleCategories)', () => {
      const junction = detectJunction(testSchema, 'articles', 'categories')

      expect(junction.tableName).toBe('articleCategories')
      expect(junction.leftResource).toBe('articles')
      expect(junction.rightResource).toBe('categories')
      expect(junction.leftKey).toBe('articleId')
      expect(junction.rightKey).toBe('categoryId')
      expect(junction.metadataColumns).toEqual(['sortOrder'])
      expect(junction.table).toBe(articleCategories)
    })

    it('should detect junction table with snake_case pattern (article_tags)', () => {
      const junction = detectJunction(testSchema, 'articles', 'tags')

      expect(junction.tableName).toBe('article_tags')
      expect(junction.leftResource).toBe('articles')
      expect(junction.rightResource).toBe('tags')
      expect(junction.leftKey).toBe('article_id')
      expect(junction.rightKey).toBe('tag_id')
      expect(junction.metadataColumns).toEqual([])
      expect(junction.table).toBe(article_tags)
    })

    it('should detect junction table with reversed naming (categoriesArticles)', () => {
      const junction = detectJunction(testSchema, 'articles', 'categories', 'categoriesArticles')

      expect(junction.tableName).toBe('categoriesArticles')
      expect(junction.leftResource).toBe('articles')
      expect(junction.rightResource).toBe('categories')
      expect(junction.leftKey).toBe('articleId')
      expect(junction.rightKey).toBe('categoryId')
    })
  })

  describe('Explicit junction table provided', () => {
    it('should use explicitly provided junction table name', () => {
      const junction = detectJunction(testSchema, 'articles', 'categories', 'articleCategories')

      expect(junction.tableName).toBe('articleCategories')
      expect(junction.leftKey).toBe('articleId')
      expect(junction.rightKey).toBe('categoryId')
    })

    it('should throw error if provided junction table does not exist', () => {
      expect(() => {
        detectJunction(testSchema, 'articles', 'categories', 'nonexistent')
      }).toThrow('Junction table nonexistent not found in schema')
    })
  })

  describe('Error cases', () => {
    it('should throw error if no junction table pattern matches', () => {
      expect(() => {
        detectJunction(testSchema, 'articles', 'nonexistent')
      }).toThrow(/Junction table not found for relation/)
    })

    it('should throw error if left key cannot be detected', () => {
      const badSchema = {
        articles,
        categories,
        badJunction: sqliteTable('badJunction', {
          wrongKey: integer('wrongKey').notNull(),
          categoryId: integer('categoryId').notNull(),
        }, table => ({
          pk: primaryKey({ columns: [table.wrongKey, table.categoryId] }),
        })),
      }

      expect(() => {
        detectJunction(badSchema, 'articles', 'categories', 'badJunction')
      }).toThrow(/Could not detect left foreign key/)
    })

    it('should throw error if right key cannot be detected', () => {
      const badSchema = {
        articles,
        categories,
        badJunction: sqliteTable('badJunction', {
          articleId: integer('articleId').notNull(),
          wrongKey: integer('wrongKey').notNull(),
        }, table => ({
          pk: primaryKey({ columns: [table.articleId, table.wrongKey] }),
        })),
      }

      expect(() => {
        detectJunction(badSchema, 'articles', 'categories', 'badJunction')
      }).toThrow(/Could not detect right foreign key/)
    })
  })

  describe('Metadata columns detection', () => {
    it('should detect metadata columns (columns that are not foreign keys)', () => {
      const junction = detectJunction(testSchema, 'articles', 'categories')

      expect(junction.metadataColumns).toContain('sortOrder')
    })

    it('should return empty array when no metadata columns exist', () => {
      const junction = detectJunction(testSchema, 'articles', 'tags')

      expect(junction.metadataColumns).toEqual([])
    })
  })
})

describe('validateJunctionConfig', () => {
  it('should validate correct junction configuration', () => {
    const junction = detectJunction(testSchema, 'articles', 'categories')

    expect(() => {
      validateJunctionConfig(junction, testSchema)
    }).not.toThrow()
  })

  it('should throw error if junction table does not exist in schema', () => {
    const invalidJunction = {
      tableName: 'nonexistent',
      leftResource: 'articles',
      rightResource: 'categories',
      leftKey: 'articleId',
      rightKey: 'categoryId',
      metadataColumns: [],
      table: null,
    }

    expect(() => {
      validateJunctionConfig(invalidJunction, testSchema)
    }).toThrow('Junction table nonexistent not found in schema')
  })

  it('should throw error if left key does not exist in junction table', () => {
    const invalidJunction = {
      tableName: 'articleCategories',
      leftResource: 'articles',
      rightResource: 'categories',
      leftKey: 'nonexistentKey',
      rightKey: 'categoryId',
      metadataColumns: [],
      table: articleCategories,
    }

    expect(() => {
      validateJunctionConfig(invalidJunction, testSchema)
    }).toThrow(/Left key nonexistentKey not found/)
  })

  it('should throw error if right key does not exist in junction table', () => {
    const invalidJunction = {
      tableName: 'articleCategories',
      leftResource: 'articles',
      rightResource: 'categories',
      leftKey: 'articleId',
      rightKey: 'nonexistentKey',
      metadataColumns: [],
      table: articleCategories,
    }

    expect(() => {
      validateJunctionConfig(invalidJunction, testSchema)
    }).toThrow(/Right key nonexistentKey not found/)
  })

  it('should throw error if metadata column does not exist', () => {
    const invalidJunction = {
      tableName: 'articleCategories',
      leftResource: 'articles',
      rightResource: 'categories',
      leftKey: 'articleId',
      rightKey: 'categoryId',
      metadataColumns: ['nonexistentColumn'],
      table: articleCategories,
    }

    expect(() => {
      validateJunctionConfig(invalidJunction, testSchema)
    }).toThrow(/Metadata column nonexistentColumn not found/)
  })
})

describe('foreign-key detection', () => {
  const people = sqliteTable('people', { id: integer('id').primaryKey(), name: text('name') })
  const skills = sqliteTable('skills', { id: integer('id').primaryKey(), name: text('name') })
  // Neither the table nor the key names follow a pattern: only the foreign keys say what it links.
  const expertise = sqliteTable('expertise', {
    who: integer('who').notNull().references(() => people.id),
    what: integer('what').notNull().references(() => skills.id),
    level: integer('level'),
  })
  const fkSchema = { people, skills, expertise }

  it('finds a junction by its foreign keys whatever its name', () => {
    expect(detectAllJunctionTables(fkSchema)).toEqual([
      expect.objectContaining({ tableName: 'expertise', leftResource: 'people', rightResource: 'skills', leftKey: 'who', rightKey: 'what', metadataColumns: ['level'] }),
    ])
  })

  it('finds an unregistered junction that links two resources', () => {
    expect(detectAllJunctionTables(fkSchema, ['people', 'skills']).map(j => j.tableName)).toEqual(['expertise'])
    expect(getM2MRelationshipsForResource('skills', fkSchema, ['people', 'skills'])).toEqual([
      expect.objectContaining({ relatedResource: 'people', direction: 'right' }),
    ])
  })

  it('needs both ends to be resources', () => {
    expect(detectAllJunctionTables(fkSchema, ['people'])).toEqual([])
  })

  it('resolves the route-side junction from foreign keys, in either direction', () => {
    expect(detectJunction(fkSchema, 'people', 'skills', undefined, undefined, undefined, { resourceNames: ['people', 'skills'] }))
      .toMatchObject({ tableName: 'expertise', leftKey: 'who', rightKey: 'what' })
    expect(detectJunction(fkSchema, 'skills', 'people', undefined, undefined, undefined, { resourceNames: ['people', 'skills'] }))
      .toMatchObject({ tableName: 'expertise', leftKey: 'what', rightKey: 'who' })
  })

  it('reads the keys of an explicit junction table from its foreign keys', () => {
    expect(detectJunction(fkSchema, 'people', 'skills', 'expertise')).toMatchObject({ leftKey: 'who', rightKey: 'what' })
  })

  it('restricts metadata to the configured columns', () => {
    const fkSchemaWithNote = {
      ...fkSchema,
      expertise: sqliteTable('expertise', {
        who: integer('who').notNull().references(() => people.id),
        what: integer('what').notNull().references(() => skills.id),
        level: integer('level'),
        internalNote: text('internal_note'),
      }),
    }
    expect(detectJunction(fkSchemaWithNote, 'people', 'skills', undefined, undefined, undefined, { metadataColumns: ['level'] }).metadataColumns)
      .toEqual(['level'])
    expect(detectJunction(fkSchemaWithNote, 'people', 'skills', 'expertise', undefined, undefined, { metadataColumns: ['level'] }).metadataColumns)
      .toEqual(['level'])
  })
})
