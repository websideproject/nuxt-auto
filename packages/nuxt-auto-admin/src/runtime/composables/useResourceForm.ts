import { computed } from 'vue'
import type { FieldConfig } from '../types'
import { useAdminResource } from './useAdminResource'
import { useAdminPermissions } from './useAdminPermissions'

/**
 * Generate form configuration from resource schema
 */
export function useResourceForm(resourceName: string, mode: 'create' | 'edit' = 'create') {
  const { resource, isLoading } = useAdminResource(resourceName)
  // `/permissions` already reports `fields[x].canWrite` per resource, and this form is the one place that
  // has to act on it — see the comment on `readonly` below.
  const { permissions } = useAdminPermissions(resourceName)

  const fields = computed<FieldConfig[]>(() => {
    if (!resource.value) return []

    const formFields = resource.value.formFields[mode] || resource.value.formFields.create
    const fieldPerms = (permissions.value as any)?.fields ?? {}

    // Filter out M2M fields (MultiRelationSelect with junctionTable)
    // These are handled separately in M2MRelationCard components
    return formFields.filter((field) => {
      if (field.widget === 'MultiRelationSelect' && field.options?.junctionTable) {
        return false
      }
      return true
    }).map((field) => {
      // ⚠ A field the caller may not WRITE is rendered read-only, so `AutoForm` strips it from the edit
      // payload instead of submitting it.
      //
      // Until S29.4 `fields[x].write` was reported here and enforced nowhere, so this form happily
      // offered an input for a column the API would silently discard — the user typed into a box whose
      // value went nowhere. Now that the API refuses such a body with 403, offering the input would turn
      // that quiet lie into an un-saveable form: every edit of the resource would fail on a field the
      // user cannot change and did not touch.
      if (fieldPerms[field.name]?.canWrite === false) {
        return { ...field, readonly: true }
      }
      return field
    })
  })

  const initialData = computed(() => {
    if (!resource.value) return {}

    const data: Record<string, unknown> = {}

    fields.value.forEach((field) => {
      // Set default values based on field type
      if (field.widget === 'CheckboxInput') {
        data[field.name] = false
      }
      else if (field.widget === 'NumberInput') {
        data[field.name] = field.options?.min || 0
      }
      else if (field.widget === 'SelectInput' && field.options?.enumValues) {
        data[field.name] = field.options.enumValues[0]
      }
      else {
        data[field.name] = ''
      }
    })

    return data
  })

  return {
    fields,
    initialData,
    isLoading,
    resource,
  }
}
