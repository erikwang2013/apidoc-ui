import debugApi from '/@/api/debugApi'
import { DebugPollParams } from '/@/api/debugApi/types'
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

// 共享 axios 拦截器靠 data.appKey/shareKey 选 token,后端限流键也依赖它们
const routeScope = (): { shareKey?: string; lang?: string } => {
  const query = router.currentRoute.value.query
  const scope: { shareKey?: string; lang?: string } = {}
  if (typeof query.shareKey === 'string' && query.shareKey) scope.shareKey = query.shareKey
  if (typeof query.lang === 'string' && query.lang) scope.lang = query.lang
  return scope
}

const runParams = (detail: ApiDetailResult, input: ProtocolDebugModel): RelayParams => ({
  appKey: String(detail.appKey ?? ''),
  // menuKey 是 urlencode 后的 Class@method,中继端点不接受编码形式
  path: decodeURIComponent(detail.menuKey),
  input: { ...input },
  ...routeScope(),
})

// poll/stop 也带完整凭证上下文,否则拦截器不附 token、会话限流键不匹配
const sessionParams = (detail: ApiDetailResult, sessionId: string): DebugPollParams => ({
  sessionId,
  appKey: String(detail.appKey ?? ''),
  ...routeScope(),
})

export const sendRelay = async (detail: ApiDetailResult, input: ProtocolDebugModel) =>
  (await debugApi.send(runParams(detail, input))).data

export const startStream = async (
  detail: ApiDetailResult,
  input: ProtocolDebugModel,
): Promise<RelayStartResult> => (await debugApi.start(runParams(detail, input))).data

export const pollStream = async (
  detail: ApiDetailResult,
  sessionId: string,
): Promise<RelayPollResult> => (await debugApi.poll(sessionParams(detail, sessionId))).data

export const stopStream = async (detail: ApiDetailResult, sessionId: string) =>
  (await debugApi.stop(sessionParams(detail, sessionId))).data
