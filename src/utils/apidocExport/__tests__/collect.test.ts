import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { collectDoc } from '../collect'
import { setBackend } from '/@/backend/state'
import { useAppOutsideStore } from '/@/store/modules/app'
import type { BackendAdapter } from '/@/backend/types'

const makeBackend = (calls: Array<Record<string, unknown>>) =>
  ({
    kind: 'uic',
    exportAllData: vi.fn(async (params: Record<string, unknown>) => {
      calls.push(params)
      return { apiData: [] }
    }),
    docsMenus: vi.fn(async () => []),
  }) as unknown as BackendAdapter

describe('collectDoc export routing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const store = useAppOutsideStore()
    store.appObject = { default: { key: 'default', title: 'Default' } } as any
  })
  afterEach(() => setBackend(null))

  it('sends the owner key for a share-record export', async () => {
    const calls: Array<Record<string, unknown>> = []
    setBackend(makeBackend(calls))

    await collectDoc({ appScopes: ['default'], key: 'share-1' })

    expect(calls[0]).toMatchObject({ key: 'share-1' })
    expect(calls[0].shareKey).toBeUndefined()
  })

  it('sends shareKey for a share-viewer export', async () => {
    const calls: Array<Record<string, unknown>> = []
    setBackend(makeBackend(calls))

    await collectDoc({ appScopes: ['default'], shareKey: 'share-1' })

    expect(calls[0]).toMatchObject({ shareKey: 'share-1' })
    expect(calls[0].key).toBeUndefined()
  })
})
