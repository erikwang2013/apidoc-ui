import type {
  ApiDetailParams,
  ApiDetailResult,
  ApiMenusParams,
  ApiMenusResult,
  ApiShareListItem,
  ApiShareListResult,
  CodeTemplateParams,
  CodeTemplateResult,
  DocDetailParams,
  DocDetailResult,
  DocMenusItem,
  DocMenusParams,
  ExportAllDataParams,
  ExportAllDataResult,
  GeneratorParams,
  VerifyAuthParams,
  VerifyAuthResult,
} from '/@/api/apidocApi/types'
import type { DebugPollParams } from '/@/api/debugApi/types'
import type { ConfigParams, ConfigResult } from '/@/api/globalApi/types'
import type {
  BackendAdapter,
  BackendKind,
  CacheAdapter,
  Capabilities,
  DebugAdapter,
  DebugRunScope,
  GeneratorAdapter,
  ShareAdapter,
} from './types'
import type {
  RelayPollResult,
  RelayStartResult,
} from '/@/pages/apiDetail/DebugTab/drivers/relay'
import type { ApiDebugResult } from '/@/api/apidocApi/types'
import type { BackendHttp } from './http'
import { unwrapEnvelope } from './http'

export type TokenProvider = (scope: string) => string | undefined

const scopeOf = (params: { appKey?: string; shareKey?: string }) =>
  params.shareKey ? `shareKey_${params.shareKey}` : params.appKey || 'global'

export interface UicAdapterOptions {
  getToken?: TokenProvider
  kind?: BackendKind
}

export function createUicAdapter(
  http: BackendHttp,
  capabilities: Capabilities,
  options: UicAdapterOptions = {},
): BackendAdapter {
  const getToken = options.getToken ?? (() => undefined)
  const tokenFor = (params: { appKey?: string; shareKey?: string }) => {
    const scope = scopeOf(params)
    return getToken(scope) || (scope.startsWith('shareKey_') ? undefined : getToken('global'))
  }

  const config = async (params: ConfigParams & { shareKey?: string }) => {
    const input = { ...params }
    return unwrapEnvelope<ConfigResult>(
      await http.get('/ui/v1/config', input as unknown as Record<string, unknown>, tokenFor(input)),
    )
  }

  const menus = async (params: ApiMenusParams) =>
    unwrapEnvelope<ApiMenusResult>(
      await http.post('/ui/v1/menus', params as unknown as Record<string, unknown>, tokenFor(params)),
    )

  const detail = async (params: ApiDetailParams) =>
    unwrapEnvelope<ApiDetailResult>(
      await http.post('/ui/v1/detail', params as unknown as Record<string, unknown>, tokenFor(params)),
    )

  const docsMenus = async (params: DocMenusParams) =>
    unwrapEnvelope<DocMenusItem[]>(
      await http.post('/ui/v1/docMenus', params as unknown as Record<string, unknown>, tokenFor(params)),
    )

  const docDetail = async (params: DocDetailParams) =>
    unwrapEnvelope<DocDetailResult>(
      await http.post('/ui/v1/docDetail', params as unknown as Record<string, unknown>, tokenFor(params)),
    )

  const verifyAuth = async (params: VerifyAuthParams) => {
    const input = { ...params }
    return unwrapEnvelope<VerifyAuthResult>(
      await http.post('/ui/v1/verifyAuth', input as unknown as Record<string, unknown>),
    )
  }

  const debug: DebugAdapter = {
    send: async (params: DebugRunScope) =>
      unwrapEnvelope<ApiDebugResult>(
        await http.post('/ui/v1/debugSend', params as unknown as Record<string, unknown>, tokenFor(params)),
      ),
    start: async (params: DebugRunScope) =>
      unwrapEnvelope<RelayStartResult>(
        await http.post('/ui/v1/debugStart', params as unknown as Record<string, unknown>, tokenFor(params)),
      ),
    poll: async (params: DebugPollParams) =>
      unwrapEnvelope<RelayPollResult>(
        await http.post('/ui/v1/debugPoll', params as unknown as Record<string, unknown>, tokenFor(params)),
      ),
    stop: async (params: DebugPollParams) =>
      unwrapEnvelope<{ ok?: boolean }>(
        await http.post('/ui/v1/debugStop', params as unknown as Record<string, unknown>, tokenFor(params)),
      ),
  }

  const share: ShareAdapter = {
    add: async (data) =>
      unwrapEnvelope<boolean>(await http.post('/ui/v1/addApiShare', data, getToken('global'))),
    list: async (data) =>
      unwrapEnvelope<ApiShareListResult>(
        await http.post('/ui/v1/getApiShareList', data, getToken('global')),
      ),
    detail: async (data) =>
      unwrapEnvelope<ApiShareListItem>(
        await http.post('/ui/v1/getApiShareDetail', data, getToken('global')),
      ),
    remove: async (data) =>
      unwrapEnvelope<boolean>(await http.post('/ui/v1/deleteApiShare', data, getToken('global'))),
    action: async (data) =>
      unwrapEnvelope(await http.post('/ui/v1/handleApiShareAction', data, getToken('global'))),
  }

  const cache: CacheAdapter = {
    clear: async () =>
      unwrapEnvelope<{ ok: boolean; mode: 'server' | 'build'; message?: string }>(
        await http.post('/ui/v1/cache/clear', {}, getToken('global')),
      ),
    warm: async () =>
      unwrapEnvelope<{ ok: boolean; mode: 'server' | 'build'; message?: string }>(
        await http.post('/ui/v1/cache/warm', {}, getToken('global')),
      ),
  }

  const generator: GeneratorAdapter = {
    render: async (data: GeneratorParams) =>
      unwrapEnvelope<{ files: Array<{ name: string; path: string; content: string }> }>(
        await http.post('/ui/v1/generator', data as unknown as Record<string, unknown>, getToken('global')),
      ),
    renderCodeTemplate: async (data: CodeTemplateParams) =>
      unwrapEnvelope<CodeTemplateResult>(
        await http.post(
          '/ui/v1/renderCodeTemplate',
          { appKey: data.appKey, template: data.template, selected: data.selected, form: data.form },
          getToken(data.appKey),
        ),
      ),
  }

  const exportAllData = async (params: ExportAllDataParams) =>
    unwrapEnvelope<ExportAllDataResult>(
      await http.post('/ui/v1/exportAllData', params as unknown as Record<string, unknown>, getToken(params.appKey || 'global')),
    )

  return {
    kind: options.kind ?? 'uic',
    capabilities,
    authHashesPassword: false,
    config,
    menus,
    detail,
    docsMenus,
    docDetail,
    verifyAuth,
    debug,
    share,
    cache,
    generator,
    exportAllData,
  }
}
