import type { AdminFieldRules, FieldConfig } from '../types'

/** The resource's form fields with the `condition` / `validation` functions from `admin.fields.ts` attached. */
export function withFieldRules(fields: FieldConfig[], rules: AdminFieldRules | undefined, resource: string): FieldConfig[] {
  const forResource = rules?.[resource]
  if (!forResource) return fields
  return fields.map((field) => {
    const rule = forResource[field.name]
    if (!rule) return field
    return {
      ...field,
      ...(rule.condition ? { condition: rule.condition } : {}),
      ...(rule.validation ? { validation: rule.validation } : {}),
    }
  })
}

/** Run a field's `validation` function: the error message, or undefined when the value is accepted. */
export async function runFieldValidation(field: FieldConfig, value: unknown, formData: Record<string, unknown>): Promise<string | undefined> {
  if (typeof field.validation !== 'function') return undefined
  const result = await field.validation(value, formData)
  if (typeof result === 'string' && result) return result
  if (result === false) return 'Invalid value'
  return undefined
}
