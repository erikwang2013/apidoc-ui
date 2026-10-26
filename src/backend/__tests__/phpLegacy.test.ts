import { describe, expect, it, vi } from 'vitest'
import type { LegacyApi } from '../phpLegacy'
import { createPhpLegacyAdapter } from '../phpLegacy'

const envelope = <T>(data: T) => Promise.resolve({ code: 0, message: 'ok', data })

const makeApi = (): LegacyApi => ({
  getConfig: vi.fn(async () => envelope({ apps: [] } as any)),
  getApiMenus: vi.fn(async () => envelope({ app: {}, data: [{ menuKey: 'k' }] } as any)),
  getApiDetail: vi.fn(async () => envelope({ menuKey: 'k', title: 't', method: 'GET', url: '/x' } as any)),
  getDocMenus: vi.fn(async () => envelope([])),
  getDocDetail: vi.fn(async () => envelope({ content: '# doc' })),
  verifyAuth: vi.fn(async () => envelope({ token: 'tok' })),
  debugSend: vi.fn(async () => envelope({ ok: true, body: 'x' })),
  debugStart: vi.fn(async () => envelope({ sessionId: 's1' })),
  debugPoll: vi.fn(async () => envelope({ messages: [] })),
  debugStop: vi.fn(async () => envelope({ ok: true })),
})

describe('createPhpLegacyAdapter', () => {
  it('uses legacy endpoints and unwraps envelopes', async () => {
    const api = makeApi()
    const adapter = createPhpLegacyAdapter(api)

    const result = await adapter.menus({ appKey: 'default' })

    expect(adapter.kind).toBe('php-legacy')
    expect(adapter.authHashesPassword).toBe(true)
    expect(result.data[0].menuKey).toBe('k')
    expect(api.getApiMenus).toHaveBeenCalledWith({ appKey: 'default' })
  })

  it('decodes the menuKey for relay calls', async () => {
    const api = makeApi()
    const adapter = createPhpLegacyAdapter(api)

    await adapter.debug.send({
      appKey: 'default',
      path: 'users%40listUsers',
      input: { target: 'https://x', payload: '' },
    })

    expect(api.debugSend).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users@listUsers' }),
    )
  })

  it('passes the token through verifyAuth', async () => {
    const api = makeApi()
    const adapter = createPhpLegacyAdapter(api)

    const result = await adapter.verifyAuth({ appKey: 'default', password: 'md5' })

    expect(result.token).toBe('tok')
    expect(api.verifyAuth).toHaveBeenCalledWith({ appKey: 'default', password: 'md5' })
  })

  it('maps poll and stop', async () => {
    const api = makeApi()
    const adapter = createPhpLegacyAdapter(api)

    await adapter.debug.poll({ sessionId: 's1' })
    await adapter.debug.stop({ sessionId: 's1' })

    expect(api.debugPoll).toHaveBeenCalledWith({ sessionId: 's1' })
    expect(api.debugStop).toHaveBeenCalledWith({ sessionId: 's1' })
  })
})
