import { post } from '/@/utils/http/axios'
import { ApiDebugResult } from '/@/api/apidocApi/types'
import { DebugRunParams, DebugPollParams } from './types'

export enum URL {
  debugSend = '/debugSend',
  debugStart = '/debugStart',
  debugPoll = '/debugPoll',
  debugStop = '/debugStop',
}

export default class debugApi {
  static send = (data: DebugRunParams) => post<ApiDebugResult>({ url: URL.debugSend, data })

  static start = (data: DebugRunParams) => post<{ sessionId: string }>({ url: URL.debugStart, data })

  static poll = (data: DebugPollParams) =>
    post<{ messages: ApiDebugResult[] }>({ url: URL.debugPoll, data })

  static stop = (data: DebugPollParams) => post<{ ok: boolean }>({ url: URL.debugStop, data })
}
