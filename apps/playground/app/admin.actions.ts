// Custom actions for the admin (docs: auto-admin/custom-actions). Handlers are functions, so they live here —
// a file bundled with the app — not in nuxt.config.
interface Article {
  id: number
  title: string
  published: boolean
}

export default defineAdminActions({
  articles: {
    // In each row's menu and on the article itself.
    publish: {
      label: 'Publish',
      icon: 'i-heroicons-rocket-launch',
      type: 'single',
      location: ['row', 'detail'],
      permission: 'update', // the API's answer for this row
      confirm: (article: Article) => `Publish "${article.title}"?`,
      handler: async (article: Article, ctx) => {
        await $fetch(ctx.path(article.id), { method: 'PATCH', body: { published: true } })
        await ctx.refresh()
        ctx.toast.success(`"${article.title}" is live`)
      }
    },
    // On the toolbar while rows are selected.
    unpublish: {
      label: 'Unpublish',
      icon: 'i-heroicons-eye-slash',
      type: 'bulk',
      location: 'toolbar',
      permission: 'update',
      confirm: (articles: Article[]) => `Unpublish ${articles.length} article${articles.length === 1 ? '' : 's'}?`,
      handler: async (articles: Article[], ctx) => {
        await Promise.all(articles.map(a => $fetch(ctx.path(a.id), { method: 'PATCH', body: { published: false } })))
        await ctx.refresh()
        ctx.toast.success(`${articles.length} unpublished`)
      }
    }
  }
})
