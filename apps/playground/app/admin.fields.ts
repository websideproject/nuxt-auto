// Field rules for the admin forms (docs: auto-admin/form-fields-widgets#field-rules). `condition` and `validation`
// are functions, so they live here — a file bundled with the app — not in nuxt.config.
export default defineAdminFields({
  articles: {
    // Checked on submit, next to the API's own validation
    slug: {
      validation: value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value ?? '')) || 'Lowercase letters, digits and single dashes'
    },
    // Shown once the article has a title
    content: {
      condition: form => !!form.title
    }
  }
})
