<template>
  <div>
    <UPageHero
      title="Nuxt Auto API"
      description="Auto-generated REST APIs with powerful authorization. Switch between roles instantly and see permissions update in real-time."
      :links="[{
        label: 'Interactive Permission Demo',
        to: '/demo',
        trailingIcon: 'i-lucide-arrow-right',
        size: 'xl'
      }, {
        label: 'Auto Admin Panel',
        to: '/admin',
        icon: 'i-heroicons-cog-6-tooth',
        size: 'xl',
        color: 'primary',
        variant: 'subtle'
      }, {
        label: 'GitHub',
        to: 'https://github.com/nuxt-auto-api',
        target: '_blank',
        icon: 'i-simple-icons-github',
        size: 'xl',
        color: 'neutral',
        variant: 'subtle'
      }]"
    />

    <!-- Permission Demo Highlight -->
    <UPageSection class="bg-gray-50 dark:bg-gray-900">
      <div class="max-w-4xl mx-auto text-center mb-12">
        <h2 class="text-3xl font-bold mb-4">
          Interactive Permission System
        </h2>
        <p class="text-lg text-gray-600 dark:text-gray-400">
          See how authorization works by switching between different user roles. Experience object-level, role-based, and field-level security in action.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        <UCard>
          <div class="text-center space-y-3">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900">
              <UIcon name="i-lucide-document-text" class="text-blue-600 dark:text-blue-400" size="24" />
            </div>
            <h3 class="font-semibold">Object-Level Auth</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Users can only edit their own posts. Admins can edit all.
            </p>
            <UButton to="/demo/posts" variant="ghost" size="xs" color="primary">
              Try Demo
            </UButton>
          </div>
        </UCard>

        <UCard>
          <div class="text-center space-y-3">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900">
              <UIcon name="i-lucide-newspaper" class="text-green-600 dark:text-green-400" size="24" />
            </div>
            <h3 class="font-semibold">Role-Based</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Only editors and admins can create articles. Users read-only.
            </p>
            <UButton to="/demo/articles" variant="ghost" size="xs" color="primary">
              Try Demo
            </UButton>
          </div>
        </UCard>

        <UCard>
          <div class="text-center space-y-3">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900">
              <UIcon name="i-lucide-users" class="text-purple-600 dark:text-purple-400" size="24" />
            </div>
            <h3 class="font-semibold">Field-Level</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Email addresses hidden unless viewing own profile or admin.
            </p>
            <UButton to="/demo/users" variant="ghost" size="xs" color="primary">
              Try Demo
            </UButton>
          </div>
        </UCard>

        <UCard>
          <div class="text-center space-y-3">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900">
              <UIcon name="i-lucide-gauge" class="text-orange-600 dark:text-orange-400" size="24" />
            </div>
            <h3 class="font-semibold">Live Permission Matrix</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              See all permissions update in real-time as you switch roles.
            </p>
            <UButton to="/demo" variant="ghost" size="xs" color="primary">
              View Matrix
            </UButton>
          </div>
        </UCard>
      </div>
    </UPageSection>

    <!-- Core Features -->
    <UPageSection
      id="features"
      title="Production-Ready Features"
      description="Everything you need to build secure, scalable REST APIs with minimal configuration."
      :features="[{
        icon: 'i-lucide-zap',
        title: 'Auto-Generated CRUD',
        description: 'Define your Drizzle schema and get full CRUD endpoints instantly. List, get, create, update, and delete operations work out of the box.'
      }, {
        icon: 'i-lucide-shield-check',
        title: 'Multi-Level Authorization',
        description: 'Operation, object, and field-level permissions. Permission-aware UI components with automatic enable/disable based on user roles.'
      }, {
        icon: 'i-lucide-database',
        title: 'TanStack Query Integration',
        description: 'Frontend composables powered by TanStack Query. Automatic caching, revalidation, optimistic updates, and infinite scroll built-in.'
      }, {
        icon: 'i-lucide-check-circle',
        title: 'Type-Safe Validation',
        description: 'Zod validation with Drizzle schema integration. Auto-generated validation schemas with custom rules support.'
      }, {
        icon: 'i-lucide-filter',
        title: 'Advanced Querying',
        description: 'Powerful query operators ($gt, $lt, $like, $in), multi-field sorting, cursor pagination, and relation loading.'
      }, {
        icon: 'i-lucide-code',
        title: 'Developer Experience',
        description: 'TypeScript-first with full type safety. Auto-imports, composables, and permission utilities for seamless development.'
      }]"
    />

    <!-- How It Works -->
    <UPageSection class="bg-gray-50 dark:bg-gray-900">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-3xl font-bold text-center mb-12">
          How It Works
        </h2>

        <div class="space-y-8">
          <div class="flex gap-6 items-start">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
              1
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold mb-2">Define Your Schema</h3>
              <p class="text-gray-600 dark:text-gray-400 mb-3">
                Use Drizzle ORM to define your database schema. That's it - CRUD endpoints are automatically generated.
              </p>
              <UCard class="bg-white dark:bg-gray-800">
                <pre class="text-sm overflow-x-auto"><code>export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: integer('user_id').notNull(),
})</code></pre>
              </UCard>
            </div>
          </div>

          <div class="flex gap-6 items-start">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
              2
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold mb-2">Add Authorization (Optional)</h3>
              <p class="text-gray-600 dark:text-gray-400 mb-3">
                Configure permissions at operation, object, or field level. Skip this for public APIs.
              </p>
              <UCard class="bg-white dark:bg-gray-800">
                <pre class="text-sm overflow-x-auto"><code>export const postsAuth = {
  permissions: {
    create: (ctx) => !!ctx.user,
    update: (ctx) => !!ctx.user,
  },
  objectLevel: async (post, ctx) => {
    return post.userId === ctx.user?.id
  }
}</code></pre>
              </UCard>
            </div>
          </div>

          <div class="flex gap-6 items-start">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
              3
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold mb-2">Use in Your Frontend</h3>
              <p class="text-gray-600 dark:text-gray-400 mb-3">
                Auto-imported composables with TanStack Query. Permission-aware components automatically enable/disable.
              </p>
              <UCard class="bg-white dark:bg-gray-800">
                <pre class="text-sm overflow-x-auto"><code>const { data } = useAutoApiList('posts')
const { canCreate } = usePermissions('posts')

&lt;PermissionButton resource="posts" action="create"&gt;
  Create Post
&lt;/PermissionButton&gt;</code></pre>
              </UCard>
            </div>
          </div>
        </div>
      </div>
    </UPageSection>

    <!-- CTA Section -->
    <UPageSection>
      <UPageCTA
        title="Experience the Interactive Demo"
        description="Switch between Admin, Editor, and User roles to see how permissions work in real-time. No setup required - just click and explore!"
        variant="subtle"
        :links="[{
          label: 'Launch Interactive Demo',
          to: '/demo',
          trailingIcon: 'i-lucide-arrow-right',
          color: 'primary',
          size: 'xl'
        }, {
          label: 'View Documentation',
          to: '/demo/docs',
          icon: 'i-lucide-book',
          color: 'neutral',
          variant: 'outline',
          size: 'xl'
        }]"
      />
    </UPageSection>
  </div>
</template>
