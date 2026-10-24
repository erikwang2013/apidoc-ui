export interface DebugRunParams {
  appKey: string
  path: string
  input: Record<string, unknown>
}

export interface DebugPollParams {
  sessionId: string
  appKey?: string
  shareKey?: string
  lang?: string
}
