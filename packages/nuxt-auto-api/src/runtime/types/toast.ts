export interface ToastProvider {
  success(title: string, description?: string): void
  error(title: string, description?: string, statusCode?: number): void
  warning(title: string, description?: string): void
  info(title: string, description?: string): void
}

export interface AutoApiToastOptions {
  enabled?: boolean
  showSuccess?: boolean
  showErrors?: boolean
}
