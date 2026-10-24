import { formatTime } from '/@/utils/helper/timeHelper'

export type DebugEncoding = 'text' | 'json' | 'hex' | 'base64'

export interface DebugLogEntry {
  time: string
  direction: 'in' | 'out'
  encoding: DebugEncoding
  body: string
  type?: string
  status?: number | string
  meta?: Record<string, unknown>
}

export interface ProtocolDebugModel {
  target: string
  headers: Record<string, string>
  query: Record<string, string>
  fields: Record<string, unknown>
  payload: string
  encoding: DebugEncoding
  timeout: number
}

export const createLogEntry = (
  direction: DebugLogEntry['direction'],
  encoding: DebugEncoding,
  body: string,
): DebugLogEntry => ({ time: formatTime(), direction, encoding, body })
