<template>
  <div class="container mx-auto py-8 px-4 max-w-4xl">
    <div class="mb-6">
      <UButton
        to="/demo"
        icon="i-heroicons-arrow-left"
        variant="ghost"
        color="gray"
        class="mb-4"
      >
        Back to Demo Home
      </UButton>

      <h1 class="text-4xl font-bold mb-2">
        Permission System Documentation
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Learn how to use the nuxt-auto-api permission system in your projects.
      </p>
    </div>

    <div class="space-y-8">
      <!-- Overview -->
      <UCard>
        <template #header>
          <h2 class="text-2xl font-semibold">
            Overview
          </h2>
        </template>

        <div class="prose dark:prose-invert max-w-none">
          <p>
            The nuxt-auto-api module provides a flexible permission system that works at multiple levels:
          </p>
          <ul>
            <li><strong>Operation-level:</strong> Control who can create, read, update, or delete resources</li>
            <li><strong>Object-level:</strong> Check permissions on specific objects (e.g., "can this user edit this post?")</li>
            <li><strong>Field-level:</strong> Control access to specific fields within a resource</li>
            <li><strong>Multi-tenancy:</strong> Scope data to organizations or tenants</li>
          </ul>
        </div>
      </UCard>

      <!-- Using usePermissions -->
      <UCard>
        <template #header>
          <h2 class="text-2xl font-semibold">
            Frontend: usePermissions Composable
          </h2>
        </template>

        <div class="prose dark:prose-invert max-w-none">
          <p>Check permissions from any Vue component:</p>

          <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>const { canCreate, canUpdate, canDelete } = usePermissions('posts')

// Use in template
&lt;UButton :disabled="!canCreate"&gt;Create Post&lt;/UButton&gt;

// Or with PermissionButton component
&lt;PermissionButton
  resource="posts"
  action="create"
  icon="i-heroicons-plus"
&gt;
  Create Post
&lt;/PermissionButton&gt;</code></pre>
        </div>
      </UCard>

      <!-- Backend Configuration -->
      <UCard>
        <template #header>
          <h2 class="text-2xl font-semibold">
            Backend: Authorization Config
          </h2>
        </template>

        <div class="prose dark:prose-invert max-w-none">
          <p>Configure permissions in your module's auth.ts file:</p>

          <h3 class="text-lg font-semibold mt-4">
            Role-based permissions
          </h3>
          <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>export const articlesAuth = {
  permissions: {
    create: ['editor', 'admin'],
    update: ['editor', 'admin'],
    delete: ['admin'],
    read: true, // Everyone can read
  },
}</code></pre>

          <h3 class="text-lg font-semibold mt-4">
            Object-level permissions
          </h3>
          <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>export const postsAuth = {
  permissions: {
    read: true,
    create: (ctx) => !!ctx.user,
    update: true,
    delete: true,
  },
  objectLevel: async (post, ctx) => {
    // Users can only edit their own posts
    if (ctx.user?.id === post.userId) return true
    // Admins can edit all posts
    if (ctx.user?.role === 'admin') return true
    return false
  },
}</code></pre>

          <h3 class="text-lg font-semibold mt-4">
            Field-level permissions
          </h3>
          <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>export const usersAuth = {
  permissions: {
    read: true,
    update: (ctx) => !!ctx.user,
  },
  fields: {
    email: {
      read: (ctx) => {
        // Can see own email or all if admin
        const userId = ctx.params.id
        return ctx.user?.id === Number(userId) || ctx.user?.role === 'admin'
      },
      write: (ctx) => ctx.user?.role === 'admin',
    },
  },
}</code></pre>
        </div>
      </UCard>

      <!-- Components -->
      <UCard>
        <template #header>
          <h2 class="text-2xl font-semibold">
            Permission-Aware Components
          </h2>
        </template>

        <div class="prose dark:prose-invert max-w-none">
          <h3 class="text-lg font-semibold">
            PermissionButton
          </h3>
          <p>Button that disables itself based on permissions:</p>
          <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>&lt;PermissionButton
  resource="posts"
  action="update"
  icon="i-heroicons-pencil"
&gt;
  Edit Post
&lt;/PermissionButton&gt;</code></pre>

          <h3 class="text-lg font-semibold mt-4">
            ResourceActions
          </h3>
          <p>Group of action buttons for a resource:</p>
          <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>&lt;ResourceActions
  resource="posts"
  :item-id="post.id"
  show-create
  show-edit
  show-delete
  @create="createPost"
  @edit="editPost"
  @delete="deletePost"
/&gt;</code></pre>
        </div>
      </UCard>

      <!-- Migration Guide -->
      <UCard>
        <template #header>
          <h2 class="text-2xl font-semibold">
            Migration to Production
          </h2>
        </template>

        <div class="prose dark:prose-invert max-w-none">
          <p>This demo uses mock authentication for easy role switching. To use in production:</p>

          <h3 class="text-lg font-semibold mt-4">
            1. Keep (Production Ready)
          </h3>
          <ul>
            <li>Permission utilities in core module</li>
            <li>usePermissions composable</li>
            <li>PermissionButton and related components</li>
            <li>Authorization configs (auth.ts files)</li>
            <li>Permission endpoints (/api/{resource}/permissions)</li>
          </ul>

          <h3 class="text-lg font-semibold mt-4">
            2. Replace
          </h3>
          <ul>
            <li><strong>/api/demo/session</strong> → better-auth session management</li>
            <li><strong>demo-session cookie</strong> → better-auth session</li>
            <li><strong>DemoRoleSwitcher</strong> → proper login/logout UI</li>
            <li><strong>Auth plugin</strong> → use auth.api.getSession() from better-auth</li>
          </ul>

          <h3 class="text-lg font-semibold mt-4">
            3. Example: Better Auth Integration
          </h3>
          <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>// server/plugins/auth.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    const session = await auth.api.getSession({ headers: event.headers })

    if (session?.user) {
      event.context.user = {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        permissions: getRolePermissions(session.user.role),
      }
    }
  })
})</code></pre>
        </div>
      </UCard>

      <!-- API Reference -->
      <UCard>
        <template #header>
          <h2 class="text-2xl font-semibold">
            API Reference
          </h2>
        </template>

        <div class="prose dark:prose-invert max-w-none">
          <h3 class="text-lg font-semibold">
            Global Permissions Endpoint (Recommended)
          </h3>
          <p>The module automatically provides a global endpoint that returns permissions for all resources in a single request:</p>
          <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>GET /api/permissions

Response:
{
  user: { id: 1, role: "admin", ... },
  permissions: {
    posts: {
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true
    },
    users: {
      canCreate: false,
      canRead: true,
      canUpdate: false,
      canDelete: false,
      fields: {
        email: { canRead: false, canWrite: false }
      }
    }
    // ... all other resources
  }
}</code></pre>

          <p>
            This is more efficient as it makes a single request and the entire response is cached.
            The <code>usePermissions()</code> composable uses this by default.
          </p>

          <h3 class="text-lg font-semibold mt-4">
            Per-Resource Endpoints
          </h3>
          <p>Each resource also has its own endpoint if needed:</p>
          <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>GET /api/{resource}/permissions

Response:
{
  resource: "posts",
  canCreate: true,
  canRead: true,
  canUpdate: true,
  canDelete: false,
  user: { ... }
}

// Use with individual: true option
const permissions = usePermissions('posts', { individual: true })</code></pre>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
