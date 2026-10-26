import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { collectDoc } from '../collect'
import { setBackend } from '/@/backend/state'
import { useAppOutsideStore } from '/@/store/modules/app'
import type { BackendAdapter } from '/@/backend/types'

const makeBackend = (
  calls: Array<Record<string, unknown>>,
  docs: Array<Record<string, unknown>>,
) =>
  ({
    kind: 'uic',
    exportAllData: vi.fn(async (params: Record<string, unknown>) => {
      calls.push(params)
      return { apiData: [] }
    }),
    docsMenus: vi.fn(async (params: Record<string, unknown>) => {
      docs.push(params)
      return []
    }),
  }) as unknown as BackendAdapter

describe('collectDoc export routing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const store = useAppOutsideStore()
    store.appObject = { default: { key: 'default', title: 'Default' } } as any
  })
  afterEach(() => setBackend(null))

  it('sends the owner key for a share-record export and reads docs without shareKey', async () => {
    const calls: Array<Record<string, unknown>> = []
    const docs: Array<Record<string, unknown>> = []
    setBackend(makeBackend(calls, docs))

    await collectDoc({ appScopes: ['default'], key: 'share-1' })

    expect(calls[0]).toMatchObject({ key: 'share-1' })
    expect(calls[0].shareKey).toBeUndefined()
    expect(docs[0]).toMatchObject({ appKey: 'default' })
    expect(docs[0].shareKey).toBeUndefined()
  })

  it('sends shareKey for a share-viewer export and keeps it on docs', async () => {
    const calls: Array<Record<string, unknown>> = []
    const docs: Array<Record<string, unknown>> = []
    setBackend(makeBackend(calls, docs))

    await collectDoc({ appScopes: ['default'], shareKey: 'share-1' })

    expect(calls[0]).toMatchObject({ shareKey: 'share-1' })
    expect(calls[0].key).toBeUndefined()
    expect(docs[0]).toMatchObject({ appKey: 'default', shareKey: 'share-1' })
  })
})
