export interface DebugRunParams {
  appKey: string
  path: string
  input: Record<string, unknown>
}

export interface DebugPollParams {
  sessionId: string
}
