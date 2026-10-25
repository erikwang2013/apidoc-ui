import apidocApi from '/@/api/apidocApi'
import debugApi from '/@/api/debugApi'
import globalApi from '/@/api/globalApi'
import type { IResponse } from '/@/utils/http/axios/type'
import type {
  ApiDebugResult,
  ApiDetailParams,
  ApiDetailResult,
  ApiMenusParams,
  ApiMenusResult,
  DocDetailParams,
  DocDetailResult,
  DocMenusItem,
  DocMenusParams,
  VerifyAuthParams,
  VerifyAuthResult,
} from '/@/api/apidocApi/types'
import type { DebugPollParams, DebugRunParams } from '/@/api/debugApi/types'
import type { ConfigParams, ConfigResult } from '/@/api/globalApi/types'
import type {
  BackendAdapter,
  Capabilities,
  DebugAdapter,
  DebugRunScope,
} from './types'
import { PHP_LEGACY_CAPABILITIES } from './detect'

export interface LegacyApi {
  getConfig(params: ConfigParams): Promise<IResponse<ConfigResult>>
  getApiMenus(params: ApiMenusParams): Promise<IResponse<ApiMenusResult>>
  getApiDetail(params: ApiDetailParams): Promise<IResponse<ApiDetailResult>>
  getDocMenus(params: DocMenusParams): Promise<IResponse<DocMenusItem[]>>
  getDocDetail(params: DocDetailParams): Promise<IResponse<DocDetailResult>>
  verifyAuth(params: VerifyAuthParams): Promise<IResponse<VerifyAuthResult>>
  debugSend(params: DebugRunParams): Promise<IResponse<ApiDebugResult>>
  debugStart(params: DebugRunParams): Promise<IResponse<{ sessionId: string }>>
  debugPoll(params: DebugPollParams): Promise<IResponse<{ messages: any[] }>>
  debugStop(params: DebugPollParams): Promise<IResponse<{ ok: boolean }>>
}

export const defaultLegacyApi: LegacyApi = {
  getConfig: (params) => globalApi.getConfig(params),
  getApiMenus: (params) => apidocApi.getApiMenus(params),
  getApiDetail: (params) => apidocApi.getApiDetail(params),
  getDocMenus: (params) => apidocApi.getDocMenus(params),
  getDocDetail: (params) => apidocApi.getDocDetail(params),
  verifyAuth: (params) => apidocApi.verifyAuth(params),
  debugSend: (params) => debugApi.send(params),
  debugStart: (params) => debugApi.start(params),
  debugPoll: (params) => debugApi.poll(params),
  debugStop: (params) => debugApi.stop(params),
}

const decodePath = (path: string) => {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

const payload = async <T>(request: Promise<IResponse<T>>): Promise<T> => (await request).data

export function createPhpLegacyAdapter(
  api: LegacyApi = defaultLegacyApi,
  capabilities: Capabilities = PHP_LEGACY_CAPABILITIES,
): BackendAdapter {
  const debug: DebugAdapter = {
    send: async (params: DebugRunScope) =>
      payload(
        api.debugSend({
          appKey: params.appKey,
          path: decodePath(params.path),
          input: params.input,
        }),
      ),
    start: async (params: DebugRunScope) =>
      payload(
        api.debugStart({
          appKey: params.appKey,
          path: decodePath(params.path),
          input: params.input,
        }),
      ),
    poll: async (params: DebugPollParams) => payload(api.debugPoll(params)),
    stop: async (params: DebugPollParams) => payload(api.debugStop(params)),
  }

  return {
    kind: 'php-legacy',
    capabilities,
    authHashesPassword: true,
    config: async (params) => payload(api.getConfig(params)),
    menus: async (params) => payload(api.getApiMenus(params)),
    detail: async (params) => payload(api.getApiDetail(params)),
    docsMenus: async (params) => payload(api.getDocMenus(params)),
    docDetail: async (params) => payload(api.getDocDetail(params)),
    verifyAuth: async (params) => payload(api.verifyAuth(params)),
    debug,
  }
}
