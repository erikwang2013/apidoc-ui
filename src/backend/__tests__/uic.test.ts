import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createUicAdapter } from '../uic'

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../contract/uic-1/fixtures/${name}.json`, import.meta.url), 'utf8'),
  )

const caps = fixture('capabilities')[0].response.data
const menus = fixture('menus')[0].response.data
const detail = fixture('detail')[0].response.data
const config = fixture('config')[0].response.data
const debug = Object.fromEntries(fixture('debug').map((f: any) => [f.name, f.response.data]))

const makeHttp = () => ({
  get: vi.fn(),
  post: vi.fn(),
})

describe('createUicAdapter', () => {
  it('posts menus and attaches the scope token', async () => {
    const http = makeHttp()
    http.post.mockResolvedValueOnce({ code: 0, message: 'ok', data: menus })
    const adapter = createUicAdapter(http as any, caps, {
      getToken: (scope) => (scope === 'default' ? 'tok' : undefined),
    })

    const result = await adapter.menus({ appKey: 'default' })

    expect(result.data.length).toBeGreaterThan(0)
    expect(http.post).toHaveBeenCalledWith('/ui/v1/menus', { appKey: 'default' }, 'tok')
  })

  it('gets config with query params and token', async () => {
    const http = makeHttp()
    http.get.mockResolvedValueOnce({ code: 0, message: 'ok', data: config })
    const adapter = createUicAdapter(http as any, caps, {
      getToken: (scope) => (scope === 'default' ? 'tok' : undefined),
    })

    const result = await adapter.config({ appKey: 'default' })

    expect(result.apps).toHaveLength(1)
    expect(http.get).toHaveBeenCalledWith('/ui/v1/config', { appKey: 'default' }, 'tok')
  })

  it('unwraps detail and protocol metadata', async () => {
    const http = makeHttp()
    http.post.mockResolvedValueOnce({ code: 0, message: 'ok', data: detail })
    const adapter = createUicAdapter(http as any, caps)

    const result = await adapter.detail({ appKey: 'default', path: detail.menuKey })

    expect(result.menuKey).toBe(detail.menuKey)
    expect(result.protocol?.name).toBe('http')
    expect(result.debug?.mode).toBe('browser-http')
  })

  it('maps debug sessions to UIC-1 endpoints', async () => {
    const http = makeHttp()
    http.post
      .mockResolvedValueOnce({ code: 0, message: 'ok', data: debug['debug-start'] })
      .mockResolvedValueOnce({ code: 0, message: 'ok', data: debug['debug-poll'] })
      .mockResolvedValueOnce({ code: 0, message: 'ok', data: debug['debug-stop'] })
    const adapter = createUicAdapter(http as any, caps)

    const start = await adapter.debug.start({
      appKey: 'default',
      path: 'ws%40chat',
      input: {},
    })
    const poll = await adapter.debug.poll({ sessionId: start.sessionId! })
    const stop = await adapter.debug.stop({ sessionId: start.sessionId! })

    expect(start.sessionId).toBe('0123456789abcdef0123456789abcdef')
    expect(poll.messages).toHaveLength(1)
    expect(stop.ok).toBe(true)
    expect(http.post).toHaveBeenNthCalledWith(
      1,
      '/ui/v1/debugStart',
      expect.objectContaining({ appKey: 'default', path: 'ws%40chat' }),
      undefined,
    )
  })

  it('turns a non-zero envelope into an auth-classifiable error', async () => {
    const http = makeHttp()
    http.post.mockResolvedValueOnce({ code: 4001, message: 'token error' })
    const adapter = createUicAdapter(http as any, caps)

    await expect(adapter.menus({ appKey: 'default' })).rejects.toMatchObject({
      response: { status: 200, data: { code: 4001, message: 'token error' } },
    })
  })

  it('sends verifyAuth without a bearer token', async () => {
    const http = makeHttp()
    http.post.mockResolvedValueOnce({ code: 0, message: 'ok', data: { token: 't' } })
    const adapter = createUicAdapter(http as any, caps)

    const result = await adapter.verifyAuth({ appKey: 'default', password: 'pw' })

    expect(result.token).toBe('t')
    expect(http.post).toHaveBeenCalledWith('/ui/v1/verifyAuth', {
      appKey: 'default',
      password: 'pw',
    })
  })
})
