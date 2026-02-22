import { useDB } from './db.js'
import { users, posts, comments } from './schema.js'

export async function seed() {
  const db = useDB()

  console.log('Seeding database...')

  // Clear existing data
  await db.delete(comments)
  await db.delete(posts)
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
  console.log('Seeding completed!')
}

// Run seed if executed directly
const isMainModule = (import.meta as any).main || import.meta.url === `file://${process.argv[1]}`

if (isMainModule) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seed failed:', error)
      process.exit(1)
    })
}
