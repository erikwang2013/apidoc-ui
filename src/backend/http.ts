import axios from 'axios'

export interface BackendHttp {
  get<T = any>(path: string, params?: Record<string, unknown>, token?: string): Promise<T>
  post<T = any>(path: string, data?: Record<string, unknown>, token?: string): Promise<T>
}

export class BackendResponseError extends Error {
  readonly response: { status: number; data: { code: number; message: string } }

  constructor(status: number, code: number, message: string) {
    super(message)
    this.name = 'BackendResponseError'
    this.response = { status, data: { code, message } }
  }
}

export function unwrapEnvelope<T>(response: unknown, status = 200): T {
  if (!response || typeof response !== 'object') {
    throw new BackendResponseError(status, 500, 'invalid backend response')
  }
  const envelope = response as { code?: unknown; message?: unknown; data?: unknown }
  if (typeof envelope.code !== 'number') {
    throw new BackendResponseError(status, 500, 'invalid backend envelope')
  }
  if (envelope.code !== 0) {
    throw new BackendResponseError(
      status,
      envelope.code,
      typeof envelope.message === 'string' ? envelope.message : 'request failed',
    )
  }
  return envelope.data as T
}

const joinPath = (baseURL: string, prefix: string) => {
  const base = (baseURL || '').replace(/\/+$/, '')
  const cleanPrefix = `/${prefix.replace(/^\/+|\/+$/g, '')}`
  return `${base}${cleanPrefix}`
}

export interface BackendHttpOptions {
  baseURL: string
  prefix: string
  timeout?: number
}

/**
 * A UIC-1 client. It deliberately does not use the legacy axios interceptor:
 * UIC-1 sends its token as `Authorization: Bearer` and always unwraps explicitly.
 */
export function createBackendHttp(options: BackendHttpOptions): BackendHttp {
  const client = axios.create({
    baseURL: joinPath(options.baseURL, options.prefix),
    timeout: options.timeout ?? 30000,
  })

  const call = async (
    method: 'get' | 'post',
    path: string,
    payload?: Record<string, unknown>,
    token?: string,
  ) => {
    const response = await client.request({
      url: path,
      method,
      params: method === 'get' ? payload : undefined,
      data: method === 'post' ? payload : undefined,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    return response.data
  }

  return {
    get: (path, params, token) => call('get', path, params, token),
    post: (path, data, token) => call('post', path, data, token),
  }
}
