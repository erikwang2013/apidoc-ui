import { DebugPollParams } from '/@/api/debugApi/types'
import type { DebugAdapter } from '/@/backend/types'
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
  path: detail.menuKey,
  input: { ...input },
  ...routeScope(),
})

// poll/stop 也带完整凭证上下文,否则拦截器不附 token、会话限流键不匹配
const sessionParams = (detail: ApiDetailResult, sessionId: string): DebugPollParams => ({
  sessionId,
  appKey: String(detail.appKey ?? ''),
  ...routeScope(),
})

export const sendRelay = async (
  backend: DebugAdapter,
  detail: ApiDetailResult,
  input: ProtocolDebugModel,
) => backend.send(runParams(detail, input))

export const startStream = async (
  backend: DebugAdapter,
  detail: ApiDetailResult,
  input: ProtocolDebugModel,
): Promise<RelayStartResult> => backend.start(runParams(detail, input))

export const pollStream = async (
  backend: DebugAdapter,
  detail: ApiDetailResult,
  sessionId: string,
): Promise<RelayPollResult> => backend.poll(sessionParams(detail, sessionId))

export const stopStream = async (
  backend: DebugAdapter,
  detail: ApiDetailResult,
  sessionId: string,
) => backend.stop(sessionParams(detail, sessionId))
