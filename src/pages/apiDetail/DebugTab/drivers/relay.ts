import debugApi from '/@/api/debugApi'
import { ApiDetailResult } from '/@/api/apidocApi/types'
import router from '/@/router'
import { DebugEncoding, ProtocolDebugModel } from './types'

export interface RelayStartResult {
  ok?: boolean
  sessionId?: string
  error?: string
}

export interface RelayStreamMessage {
  time?: string
  type?: string
  body?: string
  encoding?: DebugEncoding
}

export interface RelayPollResult {
  ok?: boolean
  messages?: RelayStreamMessage[]
  error?: string
}

interface RelayParams {
  appKey: string
  path: string
  input: Record<string, unknown>
  shareKey?: string
  lang?: string
}

const runParams = (detail: ApiDetailResult, input: ProtocolDebugModel): RelayParams => {
  const query = router.currentRoute.value.query
  const params: RelayParams = {
    appKey: String(detail.appKey ?? ''),
    // menuKey 是 urlencode 后的 Class@method,中继端点不接受编码形式
    path: decodeURIComponent(detail.menuKey),
    input: { ...input },
  }
  if (typeof query.shareKey === 'string' && query.shareKey) params.shareKey = query.shareKey
  if (typeof query.lang === 'string' && query.lang) params.lang = query.lang
  return params
}

export const sendRelay = async (detail: ApiDetailResult, input: ProtocolDebugModel) =>
  (await debugApi.send(runParams(detail, input))).data

export const startStream = async (
  detail: ApiDetailResult,
  input: ProtocolDebugModel,
): Promise<RelayStartResult> => (await debugApi.start(runParams(detail, input))).data

export const pollStream = async (sessionId: string): Promise<RelayPollResult> =>
  (await debugApi.poll({ sessionId })).data

export const stopStream = async (sessionId: string) => (await debugApi.stop({ sessionId })).data
