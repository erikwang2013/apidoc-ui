import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createUicAdapter } from '../uic'
import { authKey } from '../../utils/helper/authKey'

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../contract/uic-1/fixtures/${name}.json`, import.meta.url), 'utf8'),
  )

const caps = fixture('capabilities')[0].response.data
const menus = fixture('menus')[0].response.data
const detail = fixture('detail')[0].response.data
const config = fixture('config')[0].response.data
const debug = Object.fromEntries(fixture('debug').map((f: any) => [f.name, f.response.data]))
const share = Object.fromEntries(fixture('share').map((f: any) => [f.name, f.response.data]))
const exportAll = fixture('export')[0].response.data

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

  it('isolates tokens per host for the same app key', async () => {
    const tokens: Record<string, string> = {
      [authKey('https://a.example', 'default')]: 'tok-a',
      [authKey('https://b.example', 'default')]: 'tok-b',
      [authKey('https://a.example', 'global')]: 'global-a',
      [authKey('https://b.example', 'global')]: 'global-b',
    }
    const provider = (host: string) => (scope: string) => tokens[authKey(host, scope)]
    const httpA = makeHttp()
    const httpB = makeHttp()
    httpA.post.mockResolvedValue({ code: 0, message: 'ok', data: menus })
    httpB.post.mockResolvedValue({ code: 0, message: 'ok', data: menus })
    const a = createUicAdapter(httpA as any, caps, { getToken: provider('https://a.example') })
    const b = createUicAdapter(httpB as any, caps, { getToken: provider('https://b.example') })

    await a.menus({ appKey: 'default' })
    await b.menus({ appKey: 'default' })
    await a.menus({ appKey: 'other' })
    await b.menus({ appKey: 'other' })

    expect(httpA.post).toHaveBeenNthCalledWith(1, '/ui/v1/menus', { appKey: 'default' }, 'tok-a')
    expect(httpB.post).toHaveBeenNthCalledWith(1, '/ui/v1/menus', { appKey: 'default' }, 'tok-b')
    expect(httpA.post).toHaveBeenNthCalledWith(2, '/ui/v1/menus', { appKey: 'other' }, 'global-a')
    expect(httpB.post).toHaveBeenNthCalledWith(2, '/ui/v1/menus', { appKey: 'other' }, 'global-b')
  })

  it('routes share CRUD and share-scoped export', async () => {
    const http = makeHttp()
    const dataByPath: Record<string, unknown> = {
      '/ui/v1/addApiShare': share['share-add'],
      '/ui/v1/getApiShareList': share['share-list'],
      '/ui/v1/getApiShareDetail': share['share-detail'],
      '/ui/v1/deleteApiShare': share['share-delete'],
      '/ui/v1/handleApiShareAction': share['share-action'],
      '/ui/v1/exportAllData': exportAll,
    }
    http.post.mockImplementation(async (path: string) => ({
      code: 0,
      message: 'ok',
      data: dataByPath[path],
    }))
    const tokens: Record<string, string> = { global: 'g', 'shareKey_share-1': 's' }
    const adapter = createUicAdapter(http as any, caps, { getToken: (scope) => tokens[scope] })

    expect(await adapter.share!.add({ name: 'Team' })).toBe(true)
    expect((await adapter.share!.list({ pageIndex: 1 })).total).toBe(1)
    expect((await adapter.share!.detail({ key: 'share-1' })).key).toBe('share-1')
    expect(await adapter.share!.remove({ key: 'share-1' })).toBe(true)
    expect(await adapter.share!.action({ key: 'share-1', index: 0 })).toEqual({
      action: 'copy',
      params: { url: 'https://api.example.com/apidoc?app=default' },
    })
    expect((await adapter.exportAllData!({ key: 'share-1' })).apiData).toHaveLength(1)

    expect(http.post).toHaveBeenNthCalledWith(1, '/ui/v1/addApiShare', { name: 'Team' }, 'g')
    expect(http.post).toHaveBeenNthCalledWith(2, '/ui/v1/getApiShareList', { pageIndex: 1 }, 'g')
    expect(http.post).toHaveBeenNthCalledWith(3, '/ui/v1/getApiShareDetail', { key: 'share-1' }, 'g')
    expect(http.post).toHaveBeenNthCalledWith(4, '/ui/v1/deleteApiShare', { key: 'share-1' }, 'g')
    expect(http.post).toHaveBeenNthCalledWith(
      5,
      '/ui/v1/handleApiShareAction',
      { key: 'share-1', index: 0 },
      'g',
    )
    // 属主导出（key）用全局 token；分享 token 不能借 key 路径读取分享。
    expect(http.post).toHaveBeenNthCalledWith(6, '/ui/v1/exportAllData', { key: 'share-1' }, 'g')
  })

  it('routes share-viewer export through the share token', async () => {
    const http = makeHttp()
    http.post.mockResolvedValueOnce({ code: 0, message: 'ok', data: exportAll })
    const tokens: Record<string, string> = { global: 'g', 'shareKey_share-1': 's' }
    const adapter = createUicAdapter(http as any, caps, { getToken: (scope) => tokens[scope] })

    expect((await adapter.exportAllData!({ shareKey: 'share-1' })).apiData).toHaveLength(1)
    expect(http.post).toHaveBeenCalledWith('/ui/v1/exportAllData', { shareKey: 'share-1' }, 's')
  })

  it('does not attach the global token to a share-viewer export', async () => {
    const http = makeHttp()
    http.post.mockResolvedValueOnce({ code: 0, message: 'ok', data: exportAll })
    const adapter = createUicAdapter(http as any, caps, {
      getToken: (scope) => (scope === 'global' ? 'g' : undefined),
    })

    await adapter.exportAllData!({ shareKey: 'share-1' })

    expect(http.post).toHaveBeenCalledWith(
      '/ui/v1/exportAllData',
      { shareKey: 'share-1' },
      undefined,
    )
  })

  it('routes cache and declarative generator calls', async () => {
    const http = makeHttp()
    http.post
      .mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { ok: true, mode: 'build', message: 'build-time materialized' },
      })
      .mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { files: [{ name: 'User.ts', path: 'src/User.ts', content: 'export {}\n' }] },
      })
      .mockResolvedValueOnce({ code: 0, message: 'ok', data: { code: 'export {}\n' } })
    const adapter = createUicAdapter(http as any, caps, { getToken: () => 'g' })

    expect((await adapter.cache!.clear()).mode).toBe('build')
    expect(
      (await adapter.generator!.render({ index: 0, form: {}, files: [], tables: [] })).files[0]
        .name,
    ).toBe('User.ts')
    expect(
      (
        await adapter.generator!.renderCodeTemplate({
          appKey: 'default',
          template: { title: 't', template: 'x' },
          selected: [],
          form: {},
        })
      ).code,
    ).toBe('export {}\n')

    expect(http.post).toHaveBeenNthCalledWith(1, '/ui/v1/cache/clear', {}, 'g')
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      '/ui/v1/generator',
      { index: 0, form: {}, files: [], tables: [] },
      'g',
    )
    expect(http.post).toHaveBeenNthCalledWith(
      3,
      '/ui/v1/renderCodeTemplate',
      { appKey: 'default', template: { title: 't', template: 'x' }, selected: [], form: {} },
      'g',
    )
  })
})
