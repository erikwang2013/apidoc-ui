import { createLogEntry, DebugEncoding, DebugLogEntry } from './types'

export interface WebSocketCallbacks {
  onOpen?: () => void
  onMessage?: (entry: DebugLogEntry) => void
  onError?: (entry: DebugLogEntry) => void
  onClose?: () => void
}

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/\s+/g, '')
  if (!/^([0-9a-fA-F]{2})*$/.test(clean)) {
    throw new Error('Invalid hex payload')
  }
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

const base64ToBytes = (base64: string): Uint8Array =>
  Uint8Array.from(atob(base64.trim()), (char) => char.charCodeAt(0))

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export class BrowserWebSocketDriver {
  private socket: WebSocket | null = null

  constructor(private callbacks: WebSocketCallbacks) {}

  connect(url: string) {
    this.close()
    const socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
    this.socket = socket
    socket.onopen = () => {
      if (this.socket === socket) this.callbacks.onOpen?.()
    }
    socket.onmessage = (event) => {
      if (this.socket !== socket) return
      if (typeof event.data === 'string') {
        this.callbacks.onMessage?.(createLogEntry('in', 'text', event.data))
      } else if (event.data instanceof ArrayBuffer) {
        this.callbacks.onMessage?.(
          createLogEntry('in', 'hex', bytesToHex(new Uint8Array(event.data))),
        )
      }
    }
    socket.onerror = () => {
      if (this.socket !== socket) return
      this.callbacks.onError?.(createLogEntry('in', 'text', 'WebSocket error'))
    }
    socket.onclose = () => {
      if (this.socket !== socket) return
      this.socket = null
      this.callbacks.onClose?.()
    }
  }

  send(body: string, encoding: DebugEncoding) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }
    let data: string | Uint8Array
    if (encoding === 'hex') {
      data = hexToBytes(body)
    } else if (encoding === 'base64') {
      data = base64ToBytes(body)
    } else {
      data = body
    }
    this.socket.send(data)
    this.callbacks.onMessage?.(createLogEntry('out', encoding, body))
  }

  close() {
    const socket = this.socket
    this.socket = null
    socket?.close()
  }
}
