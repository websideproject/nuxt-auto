<template>
  <UButton
    v-bind="$attrs"
    :disabled="disabled"
    :variant="buttonVariant"
    :title="tooltipText"
  >
    <slot />
  </UButton>
</template>

<script setup lang="ts">
type Action = 'create' | 'read' | 'update' | 'delete'
type ButtonVariant = 'solid' | 'outline' | 'soft' | 'ghost' | 'link'

interface Props {
  resource: string
  action: Action
  tooltipText?: string
  disabledVariant?: ButtonVariant
}

const props = withDefaults(defineProps<Props>(), {
  tooltipText: undefined,
  disabledVariant: 'soft',
})

const {
  canCreate,
  canRead,
  canUpdate,
  canDelete,
  getActionTooltip,
} = useResourceActions(props.resource)

const isAllowed = computed(() => {
  switch (props.action) {
    case 'create':
      return canCreate.value
    case 'read':
      return canRead.value
    case 'update':
      return canUpdate.value
    case 'delete':
      return canDelete.value
    default:
      return false
  }
})

const disabled = computed(() => !isAllowed.value)

const buttonVariant = computed<ButtonVariant>(() => {
  if (disabled.value) {
    return props.disabledVariant
  }

  // Get variant from attrs if provided, otherwise use 'solid'
  const attrsVariant = (props as any).variant
  return attrsVariant || 'solid'
})

const tooltipText = computed(() => {
  if (props.tooltipText) {
    return props.tooltipText
  }
  return getActionTooltip(props.action).value
})
</script>
