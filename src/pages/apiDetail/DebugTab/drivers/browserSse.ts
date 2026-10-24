import { createLogEntry, DebugLogEntry } from './types'

export interface SseCallbacks {
  onOpen?: () => void
  onMessage?: (entry: DebugLogEntry) => void
  onError?: (entry: DebugLogEntry) => void
  onClose?: () => void
}

export class BrowserSseDriver {
  private source: EventSource | null = null

  constructor(private callbacks: SseCallbacks) {}

  connect(url: string) {
    this.close()
    const source = new EventSource(url)
    this.source = source
    source.onopen = () => {
      if (this.source === source) this.callbacks.onOpen?.()
    }
    source.onmessage = (event) => {
      if (this.source !== source) return
      const body = event.type === 'message' ? event.data : `[${event.type}] ${event.data}`
      this.callbacks.onMessage?.(createLogEntry('in', 'text', body))
    }
    source.onerror = () => {
      if (this.source !== source) return
      this.callbacks.onError?.(createLogEntry('in', 'text', 'SSE connection error'))
      if (source.readyState === EventSource.CLOSED) {
        this.source = null
        this.callbacks.onClose?.()
      }
    }
  }

  close() {
    const source = this.source
    this.source = null
    source?.close()
  }
}
