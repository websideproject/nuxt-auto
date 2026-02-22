// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/content',
    '@nuxt/hints',
    // '@scalar/nuxt',
    '@websideproject/nuxt-auto-api', // Load auto-api first to expose hook
    './modules/base',                // Registers users, posts, comments
    './modules/blog',                // Registers articles, categories, tags
    './modules/api-tokens',          // Registers apiKeys for token auth demo
    '@websideproject/nuxt-auto-admin' // Auto-generate admin UI
  ],

  autoApi: {
    prefix: '/api',
    database: {
      client: 'better-sqlite3'
    },
    // Plugins: file exports an array of AutoApiPlugin instances
    // Full closure and import support (no serialization limitations)
    plugins: '~/server/autoapi-plugins',
    pagination: {
      default: 'offset',
      defaultLimit: 20,
      maxLimit: 100
    },
    // ================================================================================
    // M2M (Many-to-Many) Configuration
    // ================================================================================
    // ⚠️ IMPORTANT: Explicit configuration is STRONGLY RECOMMENDED for production!
    // Auto-detection is experimental and fragile - it may not work with:
    //   - Non-standard naming conventions
    //   - Third-party database schemas
    //   - Irregular plurals (person/people, child/children)
    //   - Complex junction tables with business logic
    //
    // See docs: packages/nuxt-auto-api/docs/13.m2m-relationships.md
    // ================================================================================

    m2m: {
      // ─────────────────────────────────────────────────────────────────────────────
      // AUTO-DETECTION ENABLED
      // ─────────────────────────────────────────────────────────────────────────────
      // Auto-detects junction tables based on schema structure:
      // - Tables with exactly 2 FK columns (articleId, categoryId)
      // - No standalone 'id' column (composite primary key)
      // - Naming pattern matches resource pairs (articleCategories, articleTags)

      autoDetect: true,

      // Optional: Override auto-detected settings for specific relations
      relations: {
        articles: {
          categories: {
            label: 'Categories',
            help: 'Select categories for this article',
            displayField: 'name',
          },
          tags: {
            label: 'Tags',
            help: 'Add relevant tags to help organize this article',
            displayField: 'name',
          }
        }
      },
    }
  },

  autoAdmin: {
    prefix: '/admin',
    branding: {
      title: 'Auto Admin Demo',
      // logo: '/logo.svg'
      logo: '/favicon.ico'
    },
    permissions: {
      // 'disable' = show buttons/sidebar items but disable them (default)
      // 'hide' = completely hide buttons/sidebar items when no permission
      unauthorizedButtons: 'disable',
      unauthorizedSidebarItems: 'hide'
    },
    ui: {
      // How to open resource edit/view forms
      // 'modal' = Open in modal/drawer overlay (good for quick edits, default)
      // 'page' = Navigate to dedicated page (good for complex forms with M2M relations)
      editMode: 'page',
      viewMode: 'page'
    },
    resources: {
      users: {
        displayName: 'Users',
        icon: 'i-heroicons-user-group',
        group: 'Base Resources',
        order: 1
      },
      posts: {
        displayName: 'Posts',
        icon: 'i-heroicons-document-text',
        group: 'Base Resources',
        order: 2
      },
      comments: {
        displayName: 'Comments',
        icon: 'i-heroicons-chat-bubble-left',
        group: 'Base Resources',
        order: 3
      },
      articles: {
        displayName: 'Articles',
        icon: 'i-heroicons-newspaper',
        group: 'Blog',
        order: 1,
        // M2M fields (categories, tags) are automatically detected and injected! 🎉
        // Junction tables (articleCategories, articleTags) are automatically hidden! 🎉
        // No manual configuration needed!

        // Optional: Override regular field widgets if desired
        // formFields: {
        //   edit: [
        //     { name: 'title', widget: 'TextInput', required: true },
        //     { name: 'slug', widget: 'TextInput', required: true },
        //     { name: 'content', widget: 'TextareaInput' },
        //     { name: 'published', widget: 'CheckboxInput' },
        //     { name: 'authorId', widget: 'RelationSelect', label: 'Author', options: { resource: 'users', displayField: 'name' } },
        //
        //     // ⚠️ MANUAL M2M CONFIGURATION (only needed for overrides) ⚠️
        //     // Uncomment these to manually configure M2M fields
        //     // (overrides auto-detection)
        //     //
        //     // {
        //     //   name: 'categories',
        //     //   label: 'Article Categories', // Custom label
        //     //   widget: 'MultiRelationSelect',
        //     //   help: 'Select categories for this article', // Custom help text
        //     //   options: {
        //     //     resource: 'categories',
        //     //     displayField: 'name',
        //     //     // Optional: Specify junction config (only if non-standard)
        //     //     junctionTable: 'articleCategories',
        //     //     junctionLeftKey: 'articleId',
        //     //     junctionRightKey: 'categoryId',
        //     //   }
        //     // },
        //     // {
        //     //   name: 'tags',
        //     //   label: 'Tags',
        //     //   widget: 'MultiRelationSelect',
        //     //   options: {
        //     //     resource: 'tags',
        //     //     displayField: 'name',
        //     //   }
        //     // }
        //   ]
        // }
      },
      categories: {
        displayName: 'Categories',
        icon: 'i-heroicons-folder',
        group: 'Blog',
        order: 2
      },
      tags: {
        displayName: 'Tags',
        icon: 'i-heroicons-tag',
        group: 'Blog',
        order: 3
      },
      apiKeys: {
        displayName: 'API Keys',
        icon: 'i-heroicons-key',
        group: 'Auth',
        order: 1
      },

      // ✅ Junction tables (articleCategories, articleTags) are automatically detected and hidden!
      // No manual configuration needed! 🎉

      // ⚠️ MANUAL JUNCTION TABLE CONFIGURATION (only needed for overrides) ⚠️
      // Uncomment these ONLY if you need to override auto-detection:
      //
      // Force a table to be hidden from sidebar (even if not detected as junction):
      // articleCategories: {
      //   type: 'junction'
      // },
      // articleTags: {
      //   type: 'junction'
      // },
      //
      // Force a junction-like table to show in sidebar (override auto-detection):
      // orderItems: {
      //   type: 'resource',  // Show in sidebar despite matching junction pattern
      //   displayName: 'Order Items',
      //   icon: 'i-heroicons-shopping-cart',
      // }
    },
    customPages: [
      {
        name: 'analytics',
        label: 'Analytics',
        path: 'analytics',
        icon: 'i-heroicons-chart-bar',
        group: 'Management',
        order: 1
      },
      {
        name: 'reports',
        label: 'Reports',
        path: 'reports',
        icon: 'i-heroicons-document-chart-bar',
        group: 'Management',
        order: 2
      },
      {
        name: 'settings',
        label: 'Settings',
        path: 'settings',
        icon: 'i-heroicons-cog-6-tooth',
        order: 999,
        // Example permission check - can be string, array, or function
        // permissions: 'admin',  // Single permission string
        // permissions: ['admin', 'settings.manage'],  // Array - user needs ALL
        canAccess: async (user: any) => {
          // Custom logic - for demo, always return true
          // In real app, check user.role, user.permissions, etc.
          return true
        }
      }
    ]
  },

  nitro: {
    experimental: {
      openAPI: true,
    },
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
