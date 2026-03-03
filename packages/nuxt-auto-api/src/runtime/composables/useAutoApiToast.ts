import { inject } from '#imports'
import type { ToastProvider } from '../types/toast'

export function useAutoApiToast() {
  const toastProvider = inject<ToastProvider>('autoApiToastProvider', null)

  const errorMessages: Record<number, { title: string; description: string }> = {
    400: {
      title: 'Validation Error',
      description: 'Please check your input and try again.'
    },
    401: {
      title: 'Authentication Required',
      description: 'You need to be logged in to perform this action.'
    },
    403: {
      title: 'Access Denied',
      description: 'You do not have permission to perform this action.'
    },
    404: {
      title: 'Not Found',
      description: 'The requested resource could not be found.'
    },
    409: {
      title: 'Conflict',
      description: 'This action conflicts with existing data.'
    },
    422: {
      title: 'Unprocessable Entity',
      description: 'The request was valid but contains semantic errors.'
    },
    500: {
      title: 'Server Error',
      description: 'An unexpected error occurred. Please try again later.'
    }
  }

  const handleSuccess = (message: string, description?: string) => {
    if (toastProvider) {
      toastProvider.success(message, description)
    }
  }

  const handleError = (error: any, customMessage?: string) => {
    if (!toastProvider) return

    const statusCode = error?.statusCode || error?.response?.status || 500
    const errorMessage = errorMessages[statusCode] || errorMessages[500]

    // Use custom message if provided, otherwise use status-based message
    const title = customMessage || errorMessage.title
    const description = error?.message || error?.data?.message || errorMessage.description

    toastProvider.error(title, description, statusCode)
  }

  const handleWarning = (message: string, description?: string) => {
    if (toastProvider) {
      toastProvider.warning(message, description)
    }
  }

  const handleInfo = (message: string, description?: string) => {
    if (toastProvider) {
      toastProvider.info(message, description)
    }
  }

  return {
    handleSuccess,
    handleError,
    handleWarning,
    handleInfo,
    isAvailable: !!toastProvider
  }
}
