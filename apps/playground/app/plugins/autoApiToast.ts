interface ToastProvider {
  success(title: string, description?: string): void
  error(title: string, description?: string, statusCode?: number): void
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
        color: 'green',
        icon: 'i-heroicons-check-circle'
      })
    },

    error(title: string, description?: string, statusCode?: number) {
      toast.add({
        title,
        description,
        color: 'red',
        icon: 'i-heroicons-exclamation-circle',
        timeout: 5000
      })
    },

    warning(title: string, description?: string) {
      toast.add({
        title,
        description,
        color: 'yellow',
        icon: 'i-heroicons-exclamation-triangle'
      })
    },

    info(title: string, description?: string) {
      toast.add({
        title,
        description,
        color: 'blue',
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
