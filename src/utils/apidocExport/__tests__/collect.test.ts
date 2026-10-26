import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { collectDoc, ownerExportAppScopes } from '../collect'
import { setBackend } from '/@/backend/state'
import { useAppOutsideStore } from '/@/store/modules/app'
import type { BackendAdapter } from '/@/backend/types'

const makeBackend = (calls: Array<Record<string, unknown>>, docs: Array<Record<string, unknown>>) =>
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
  } as unknown as BackendAdapter)

describe('collectDoc export routing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const store = useAppOutsideStore()
    store.appObject = { default: { key: 'default', title: 'Default' } } as any
  })
  afterEach(() => {
    setBackend(null)
    vi.restoreAllMocks()
  })

  it('derives the owner doc scope from the share appKeys', () => {
    expect(ownerExportAppScopes({ type: 'app', appKeys: ['a', 'b'] }, ['a', 'b', 'c'])).toEqual([
      'a',
      'b',
    ])
    expect(ownerExportAppScopes({ type: 'all' }, ['a', 'b'])).toEqual(['a', 'b'])
    expect(ownerExportAppScopes({ type: 'app' }, ['a', 'b'])).toEqual(['a', 'b'])
    // api 分享无 appKeys 时没有可安全导出的文档范围。
    expect(ownerExportAppScopes({ type: 'api' }, ['a', 'b'])).toEqual([])
  })

  it('only reads in-scope docs and skips an inaccessible app without rejecting', async () => {
    const store = useAppOutsideStore()
    store.appObject = {
      default: { key: 'default', title: 'Default' },
      protected: { key: 'protected', title: 'Protected' },
      outOfScope: { key: 'outOfScope', title: 'Out of scope' },
    } as any
    const calls: Array<Record<string, unknown>> = []
    const docs: string[] = []
    setBackend({
      kind: 'uic',
      exportAllData: vi.fn(async (params: Record<string, unknown>) => {
        calls.push(params)
        return {
          apiData: [
            {
              key: 'default',
              title: 'Default',
              appKey: 'default',
              children: [
                { name: 'list', title: 'List', menuKey: 'm1', method: 'GET', url: '/users' },
              ],
            },
          ],
        }
      }),
      docsMenus: vi.fn(async (params: Record<string, unknown>) => {
        docs.push(String(params.appKey))
        if (params.appKey === 'protected') throw new Error('token error')
        return []
      }),
    } as unknown as BackendAdapter)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const scopes = ownerExportAppScopes(
      { type: 'app', appKeys: ['default', 'protected'] },
      Object.keys(store.appObject),
    )
    // protected 无 app token：只跳过它的文档，API 导出与其余 app 文档保留。
    await expect(collectDoc({ appScopes: scopes, key: 'share-1' })).resolves.toHaveLength(1)

    expect(calls[0]).toMatchObject({ key: 'share-1' })
    expect(docs).toEqual(['default', 'protected'])
    expect(docs).not.toContain('outOfScope')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('protected'))
  })

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
