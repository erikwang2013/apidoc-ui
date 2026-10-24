import { createLogEntry, DebugLogEntry } from './types'

export interface SseCallbacks {
  onOpen?: () => void
  onMessage?: (entry: DebugLogEntry) => void
  onError?: (entry: DebugLogEntry) => void
  onClose?: () => void
}

export class BrowserSseDriver {
  private controller: AbortController | null = null

  connect(
    url: string,
    headers: Record<string, string>,
    onMessage: (entry: DebugLogEntry) => void,
    onError: (entry: DebugLogEntry) => void,
    onClose: () => void,
    onOpen?: () => void,
  ) {
    this.close()
    const controller = new AbortController()
    this.controller = controller
    const requestHeaders: Record<string, string> = { Accept: 'text/event-stream' }
    Object.entries(headers).forEach(([name, value]) => {
      if (name && value !== '') requestHeaders[name] = value
    })
    void this.open(url, requestHeaders, controller, { onOpen, onMessage, onError, onClose })
  }

  close() {
    const controller = this.controller
    this.controller = null
    controller?.abort()
  }

  private async open(
    url: string,
    headers: Record<string, string>,
    controller: AbortController,
    callbacks: SseCallbacks,
  ) {
    try {
      const response = await fetch(url, { headers, signal: controller.signal })
      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`)
      }
      if (this.controller !== controller) return
      callbacks.onOpen?.()
      await this.read(response.body, controller, callbacks)
      if (this.controller !== controller) return
      this.controller = null
      callbacks.onClose?.()
    } catch (error) {
      if (this.controller !== controller) return
      this.controller = null
      if (!controller.signal.aborted) {
        callbacks.onError?.(createLogEntry('in', 'text', (error as Error).message))
      }
      callbacks.onClose?.()
    }
  }

  private async read(
    body: ReadableStream<Uint8Array>,
    controller: AbortController,
    callbacks: SseCallbacks,
  ) {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let event = ''
    let data: string[] = []

    const dispatch = () => {
      if (data.length) {
        const text = data.join('\n')
        const message = event && event !== 'message' ? `[${event}] ${text}` : text
        callbacks.onMessage?.(createLogEntry('in', 'text', message))
      }
      event = ''
      data = []
    }

    const handleLine = (line: string) => {
      if (line === '') {
        dispatch()
        return
      }
      if (line.startsWith(':')) return
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      let value = colon === -1 ? '' : line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') {
        event = value
      } else if (field === 'data') {
        data.push(value)
      }
      // id/retry are accepted for protocol compatibility but not surfaced in the log
    }

    const parseLines = () => {
      // keep a trailing CR: it may be the first half of a CRLF split across chunks
      const pendingCR = buffer.endsWith('\r')
      const searchable = pendingCR ? buffer.slice(0, -1) : buffer
      const pattern = /\r\n|\n|\r/g
      let consumed = 0
      let match = pattern.exec(searchable)
      while (match) {
        handleLine(searchable.slice(consumed, match.index))
        consumed = match.index + match[0].length
        match = pattern.exec(searchable)
      }
      buffer = searchable.slice(consumed) + (pendingCR ? '\r' : '')
    }

    try {
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        parseLines()
      }
      buffer += decoder.decode()
      parseLines()
    } finally {
      reader.releaseLock()
    }
  }
}
