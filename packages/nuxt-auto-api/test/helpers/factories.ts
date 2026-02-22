/**
 * Factory pattern for creating test data
 */
let counter = 0
export const UserFactory = {
  build: (overrides = {}) => ({
    email: `test${Date.now()}_${counter++}@example.com`,
    name: 'Test User',
    role: 'user',
    ...overrides
  }),

  create: async (db: any, schema: any, overrides = {}) => {
    const [user] = await db.insert(schema.users)
      .values(UserFactory.build(overrides))
      .returning()
    return user
  }
}

export const PostFactory = {
  build: (userId: number, overrides = {}) => ({
    title: `Test Post ${Date.now()}`,
    content: 'Test content',
    userId,
    published: false,
    ...overrides
  }),

  create: async (db: any, schema: any, userId: number, overrides = {}) => {
    const [post] = await db.insert(schema.posts)
      .values(PostFactory.build(userId, overrides))
      .returning()
    return post
  }
}
