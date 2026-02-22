import { createHash } from 'node:crypto'
import { useDB } from './db'
import { users, posts, comments } from './schema'
import { articles, categories, tags, articleCategories, articleTags } from '../../modules/blog/schema'
import { apiKeys } from '../../modules/api-tokens/schema'

export async function seed() {
  const db = useDB()

  console.log('Seeding database...')

  // Clear existing data (child tables first due to foreign keys)
  await db.delete(articleTags)
  await db.delete(articleCategories)
  await db.delete(articles)
  await db.delete(tags)
  await db.delete(categories)
  await db.delete(comments)
  await db.delete(posts)
  await db.delete(apiKeys)
  await db.delete(users)

  // Create users with specific IDs matching demo auth
  const insertedUsers = await db
    .insert(users)
    .values([
      {
        id: 1,
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        password: '$2a$10$hashed_password_admin_123',
        apiKey: 'sk_live_admin_abc123xyz789',
      },
      {
        id: 2,
        email: 'editor@example.com',
        name: 'Editor User',
        role: 'editor',
        password: '$2a$10$hashed_password_editor_456',
        apiKey: 'sk_live_editor_def456uvw012',
      },
      {
        id: 3,
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
        password: '$2a$10$hashed_password_user_789',
        apiKey: 'sk_live_user_ghi789rst345',
      },
    ])
    .returning()

  console.log(`Created ${insertedUsers.length} users`)

  // Create posts with different ownership for demo
  const insertedPosts = await db
    .insert(posts)
    .values([
      {
        title: 'My First Post',
        content: 'This is a post by the regular user (ID 3). They should be able to edit this.',
        published: true,
        userId: 3, // Regular user
      },
      {
        title: 'My Draft Post',
        content: 'This is a draft post by the regular user.',
        published: false,
        userId: 3, // Regular user
      },
      {
        title: 'Editor\'s Featured Article',
        content: 'This is a post created by the editor user.',
        published: true,
        userId: 2, // Editor
      },
      {
        title: 'Editor\'s Work in Progress',
        content: 'Another post by the editor.',
        published: false,
        userId: 2, // Editor
      },
      {
        title: 'Admin Announcement',
        content: 'Important announcement from the admin.',
        published: true,
        userId: 1, // Admin
      },
      {
        title: 'System Update',
        content: 'System maintenance scheduled.',
        published: true,
        userId: 1, // Admin
      },
      // Additional posts for aggregation demos
      { title: 'Post 7', content: 'Content for aggregation test', published: true, userId: 1 },
      { title: 'Post 8', content: 'Content for aggregation test', published: false, userId: 1 },
      { title: 'Post 9', content: 'Content for aggregation test', published: true, userId: 2 },
      { title: 'Post 10', content: 'Content for aggregation test', published: true, userId: 2 },
      { title: 'Post 11', content: 'Content for aggregation test', published: false, userId: 2 },
      { title: 'Post 12', content: 'Content for aggregation test', published: true, userId: 3 },
      { title: 'Post 13', content: 'Content for aggregation test', published: true, userId: 3 },
      { title: 'Post 14', content: 'Content for aggregation test', published: false, userId: 3 },
      { title: 'Post 15', content: 'Content for aggregation test', published: true, userId: 1 },
      { title: 'Post 16', content: 'Content for aggregation test', published: true, userId: 1 },
      { title: 'Post 17', content: 'Content for aggregation test', published: false, userId: 2 },
      { title: 'Post 18', content: 'Content for aggregation test', published: true, userId: 2 },
      { title: 'Post 19', content: 'Content for aggregation test', published: true, userId: 3 },
      { title: 'Post 20', content: 'Content for aggregation test', published: false, userId: 3 },
    ])
    .returning()

  console.log(`Created ${insertedPosts.length} posts`)

  // Create comments
  const insertedComments = await db
    .insert(comments)
    .values([
      {
        content: 'Great post!',
        postId: insertedPosts[0].id,
        userId: 2, // Editor commenting
      },
      {
        content: 'Thanks for sharing',
        postId: insertedPosts[0].id,
        userId: 1, // Admin commenting
      },
      {
        content: 'Very informative',
        postId: insertedPosts[2].id,
        userId: 3, // Regular user commenting
      },
    ])
    .returning()

  console.log(`Created ${insertedComments.length} comments`)

  // Create categories
  const insertedCategories = await db
    .insert(categories)
    .values([
      {
        name: 'Technology',
        slug: 'technology',
        description: 'Tech news and tutorials',
      },
      {
        name: 'Design',
        slug: 'design',
        description: 'UI/UX and design principles',
      },
      {
        name: 'Business',
        slug: 'business',
        description: 'Business insights and strategies',
      },
    ])
    .returning()

  console.log(`Created ${insertedCategories.length} categories`)

  // Create tags
  const insertedTags = await db
    .insert(tags)
    .values([
      { name: 'JavaScript', slug: 'javascript' },
      { name: 'TypeScript', slug: 'typescript' },
      { name: 'Vue', slug: 'vue' },
      { name: 'Nuxt', slug: 'nuxt' },
      { name: 'Design Systems', slug: 'design-systems' },
      { name: 'Startup', slug: 'startup' },
    ])
    .returning()

  console.log(`Created ${insertedTags.length} tags`)

  // Create articles - published ones readable by all, drafts only by editors/admins
  const insertedArticles = await db
    .insert(articles)
    .values([
      {
        title: 'Getting Started with Nuxt 4',
        content: 'Nuxt 4 brings exciting new features including better performance, improved DX, and more. In this article, we explore the key changes and how to migrate your existing apps.',
        slug: 'getting-started-nuxt-4',
        published: true,
        authorId: 2, // Editor
      },
      {
        title: 'Building Type-Safe APIs with Drizzle',
        content: 'Drizzle ORM provides excellent TypeScript support for building type-safe database queries. Learn how to set up Drizzle and create your first schema.',
        slug: 'type-safe-apis-drizzle',
        published: true,
        authorId: 1, // Admin
      },
      {
        title: 'Modern Design Systems',
        content: 'A comprehensive guide to building scalable design systems that work across multiple platforms and frameworks.',
        slug: 'modern-design-systems',
        published: true,
        authorId: 2, // Editor
      },
      {
        title: 'Draft: Advanced Vue Patterns',
        content: 'Work in progress on advanced Vue patterns... (only editors/admins can see this)',
        slug: 'draft-advanced-vue-patterns',
        published: false,
        authorId: 2, // Editor
      },
      {
        title: 'Draft: Startup Best Practices',
        content: 'Key lessons learned from building successful startups in 2026. (draft)',
        slug: 'draft-startup-best-practices',
        published: false,
        authorId: 1, // Admin
      },
    ])
    .returning()

  console.log(`Created ${insertedArticles.length} articles`)

  // Link articles to categories
  await db.insert(articleCategories).values([
    { articleId: insertedArticles[0].id, categoryId: insertedCategories[0].id },
    { articleId: insertedArticles[1].id, categoryId: insertedCategories[0].id },
    { articleId: insertedArticles[2].id, categoryId: insertedCategories[1].id },
    { articleId: insertedArticles[3].id, categoryId: insertedCategories[2].id },
  ])

  console.log('Linked articles to categories')

  // Link articles to tags
  await db.insert(articleTags).values([
    { articleId: insertedArticles[0].id, tagId: insertedTags[3].id }, // Nuxt 4 -> Nuxt
    { articleId: insertedArticles[0].id, tagId: insertedTags[1].id }, // Nuxt 4 -> TypeScript
    { articleId: insertedArticles[1].id, tagId: insertedTags[1].id }, // Drizzle -> TypeScript
    { articleId: insertedArticles[1].id, tagId: insertedTags[0].id }, // Drizzle -> JavaScript
    { articleId: insertedArticles[2].id, tagId: insertedTags[4].id }, // Design -> Design Systems
    { articleId: insertedArticles[3].id, tagId: insertedTags[5].id }, // Startup -> Startup
  ])

  console.log('Linked articles to tags')

  // Create API keys (pre-hashed — the plugin normally hashes on create)
  // These raw tokens can be used with: Authorization: Bearer <token>
  //
  // Admin's unrestricted key:  sk_test_admin_unrestricted
  // Editor's scoped key:       sk_test_editor_articles
  // User's read-only key:      sk_test_user_readonly
  const hash = (raw: string) => createHash('sha256').update(raw).digest('hex')

  const insertedApiKeys = await db
    .insert(apiKeys)
    .values([
      {
        name: 'Admin Unrestricted Key',
        key: hash('sk_test_admin_unrestricted'),
        userId: 1,
        scopes: ['*'] as any,
      },
      {
        name: 'Editor Articles Key',
        key: hash('sk_test_editor_articles'),
        userId: 2,
        scopes: ['articles:read', 'articles:create', 'articles:update'] as any,
      },
      {
        name: 'User Read-Only Key',
        key: hash('sk_test_user_readonly'),
        userId: 3,
        scopes: ['articles:read', 'posts:read', 'categories:read', 'tags:read'] as any,
      },
    ])
    .returning()

  console.log(`Created ${insertedApiKeys.length} API keys`)
  console.log('  Test tokens (use with Authorization: Bearer <token>):')
  console.log('    Admin (unrestricted):         sk_test_admin_unrestricted')
  console.log('    Editor (articles r/w):        sk_test_editor_articles')
  console.log('    User (read-only):             sk_test_user_readonly')

  console.log('Seeding completed!')
}

// Run seed if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seed failed:', error)
      process.exit(1)
    })
}
