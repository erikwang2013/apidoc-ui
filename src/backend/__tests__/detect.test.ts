import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDetectionCache, detectBackend, BackendDetectionError } from '../detect'

const caps = (backend: 'php' | 'go' | 'rust', contract = '1.0') => ({
  code: 0,
  message: 'ok',
  data: {
    contract,
    backend,
    version: '1.0.0',
    features: {
      debug: { browser: [], relay: [], modes: [] },
    },
  },
})

beforeEach(() => clearDetectionCache())

describe('detectBackend', () => {
  it('prefers UIC-1 when capabilities respond', async () => {
    const probe = vi.fn(async (path: string) =>
      path.endsWith('/ui/v1/capabilities')
        ? { status: 200, json: caps('go') }
        : { status: 404 },
    )
    const detected = await detectBackend({
      host: 'https://a',
      prefix: '/apidoc',
      override: 'auto',
      probe,
    })
    expect(detected.kind).toBe('uic')
    expect(detected.capabilities.backend).toBe('go')
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('falls back to legacy PHP', async () => {
    const probe = vi.fn(async (path: string) =>
      path.endsWith('/config') ? { status: 200, json: { code: 0, data: {} } } : { status: 404 },
    )
    const detected = await detectBackend({
      host: 'https://a',
      prefix: '/apidoc',
      override: 'auto',
      probe,
    })
    expect(detected.kind).toBe('php-legacy')
    expect(detected.capabilities.contract).toBe('legacy')
  })

  it('recognizes guarded legacy PHP', async () => {
    const probe = vi.fn(async (path: string) =>
      path.endsWith('/config')
        ? { status: 401, json: { code: 4001, message: 'token error' } }
        : { status: 404 },
    )
    const detected = await detectBackend({
      host: 'https://a',
      prefix: '/apidoc',
      override: 'auto',
      probe,
    })
    expect(detected.kind).toBe('php-legacy')
  })

  it('rejects a backend that does not match the override', async () => {
    const probe = vi.fn(async () => ({ status: 200, json: caps('php') }))
    await expect(
      detectBackend({ host: 'https://a', prefix: '/apidoc', override: 'go', probe }),
    ).rejects.toBeInstanceOf(BackendDetectionError)
  })

  it('ignores an incompatible contract major', async () => {
    const probe = vi.fn(async (path: string) =>
      path.endsWith('/ui/v1/capabilities')
        ? { status: 200, json: caps('go', '2.0') }
        : { status: 404 },
    )
    await expect(
      detectBackend({ host: 'https://a', prefix: '/apidoc', override: 'auto', probe }),
    ).rejects.toBeInstanceOf(BackendDetectionError)
  })

  it('caches the result per host, prefix and override', async () => {
    const probe = vi.fn(async () => ({ status: 200, json: caps('rust') }))
    await detectBackend({ host: 'https://a', prefix: '/apidoc', override: 'auto', probe })
    await detectBackend({ host: 'https://a', prefix: '/apidoc', override: 'auto', probe })
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
