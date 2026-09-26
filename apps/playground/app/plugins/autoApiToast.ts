interface ToastProvider {
  success(title: string, description?: string): void
  error(title: string, description?: string, _statusCode?: number): void
  warning(title: string, description?: string): void
  info(title: string, description?: string): void
}

export default defineNuxtPlugin(() => {
  const toast = useToast()

  const toastProvider: ToastProvider = {
    success(title: string, description?: string) {
      toast.add({
        title,
        description,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    },

    error(title: string, description?: string, _statusCode?: number) {
      toast.add({
        title,
        description,
        color: 'error',
        icon: 'i-heroicons-exclamation-circle',
        timeout: 5000
      })
    },

    warning(title: string, description?: string) {
      toast.add({
        title,
        description,
        color: 'warning',
        icon: 'i-heroicons-exclamation-triangle'
      })
    },

    info(title: string, description?: string) {
      toast.add({
        title,
        description,
        color: 'info',
        icon: 'i-heroicons-information-circle'
      })
    }
  }

  return {
    provide: {
      autoApiToastProvider: toastProvider
    }
  }
})
