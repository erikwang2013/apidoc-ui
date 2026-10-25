import type { BackendAdapter } from './types'

let current: BackendAdapter | null = null

export const getBackend = (): BackendAdapter => {
  if (!current) {
    throw new Error('backend is not initialized')
  }
  return current
}

export const setBackend = (adapter: BackendAdapter | null) => {
  current = adapter
}
