import { computed } from 'vue'
import type { FieldConfig, ResourceSchema } from '../types'

/**
 * Generate form configuration from resource schema
 */
export function useResourceForm(resourceName: string, mode: 'create' | 'edit' = 'create') {
  const { resource, isLoading } = useAdminResource(resourceName)

  const fields = computed<FieldConfig[]>(() => {
    if (!resource.value) return []

    const formFields = resource.value.formFields[mode] || resource.value.formFields.create

    // Filter out M2M fields (MultiRelationSelect with junctionTable)
    // These are handled separately in M2MRelationCard components
    return formFields.filter(field => {
      if (field.widget === 'MultiRelationSelect' && field.options?.junctionTable) {
        return false
      }
      return true
    })
  })

  const initialData = computed(() => {
    if (!resource.value) return {}

    const data: Record<string, any> = {}

    fields.value.forEach((field) => {
      // Set default values based on field type
      if (field.widget === 'CheckboxInput') {
        data[field.name] = false
      } else if (field.widget === 'NumberInput') {
        data[field.name] = field.options?.min || 0
      } else if (field.widget === 'SelectInput' && field.options?.enumValues) {
        data[field.name] = field.options.enumValues[0]
      } else {
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
