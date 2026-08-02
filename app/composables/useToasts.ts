import { reactive } from 'vue'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

const toasts = reactive<Toast[]>([])
let nextId = 1
const AUTO_DISMISS_MS = 4500

export function useToasts() {
  function dismissToast(id: number) {
    const i = toasts.findIndex((t) => t.id === id)
    if (i !== -1) toasts.splice(i, 1)
  }

  function showToast(message: string, type: Toast['type'] = 'success') {
    const id = nextId++
    toasts.push({ id, message, type })
    setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
  }

  return { toasts, showToast, dismissToast }
}
