import type {
  ApiDebugResult,
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
import type { DebugPollParams, DebugRunParams } from '/@/api/debugApi/types'
import type { ConfigParams, ConfigResult } from '/@/api/globalApi/types'
import type {
  RelayPollResult,
  RelayStartResult,
} from '/@/pages/apiDetail/DebugTab/drivers/relay'

export type BackendKind = 'uic' | 'php-legacy'
export type BackendOverride = 'auto' | 'php' | 'go' | 'rust'

export type DebugMode =
  | 'browser-http'
  | 'browser-websocket'
  | 'browser-sse'
  | 'relay-unary'
  | 'relay-stream'

export interface DebugFeatures {
  browser: string[]
  relay: string[]
  modes: DebugMode[]
}

export interface ShareFeatures {
  link: boolean
  records: boolean
  actions: boolean
}

export interface CacheFeatures {
  manage: boolean
  mode: 'server' | 'build'
}

export interface GeneratorFeatures {
  forms: boolean
  templates: boolean
  sideEffects: boolean
}

export interface AuthFeatures {
  global: boolean
  app: boolean
  shareToken: boolean
}

export interface Features {
  menus: boolean
  detail: boolean
  docs: boolean
  protocolDefinitions: boolean
  debug: DebugFeatures
  share: ShareFeatures
  cache: CacheFeatures
  generator: GeneratorFeatures
  exports: string[]
  auth: AuthFeatures
}

export interface Capabilities {
  contract: string
  backend: 'php' | 'go' | 'rust'
  version: string
  features: Features
}

export interface DebugAdapter {
  send(params: DebugRunParams): Promise<ApiDebugResult>
  start(params: DebugRunParams): Promise<RelayStartResult>
  poll(params: DebugPollParams): Promise<RelayPollResult>
  stop(params: DebugPollParams): Promise<{ ok?: boolean }>
}

export interface ShareAdapter {
  add(data: Record<string, unknown>): Promise<boolean>
  list(data: { pageIndex: number }): Promise<ApiShareListResult>
  detail(data: { key: string }): Promise<ApiShareListItem>
  remove(data: { key: string }): Promise<boolean>
  action(data: { key: string; index: number }): Promise<unknown>
}

export interface CacheAdapter {
  clear(): Promise<{ ok: boolean; mode: 'server' | 'build'; message?: string }>
  warm(): Promise<{ ok: boolean; mode: 'server' | 'build'; message?: string }>
}

export interface GeneratorAdapter {
  render(data: GeneratorParams): Promise<{ files: Array<{ name: string; path: string; content: string }> }>
  renderCodeTemplate(data: CodeTemplateParams): Promise<CodeTemplateResult>
}

export interface BackendAdapter {
  kind: BackendKind
  capabilities: Capabilities
  /** Legacy PHP expects md5(password); UIC-1 expects plaintext over HTTPS. */
  authHashesPassword: boolean
  config(params: ConfigParams & { shareKey?: string }): Promise<ConfigResult>
  menus(params: ApiMenusParams): Promise<ApiMenusResult>
  detail(params: ApiDetailParams): Promise<ApiDetailResult>
  docsMenus(params: DocMenusParams): Promise<DocMenusItem[]>
  docDetail(params: DocDetailParams): Promise<DocDetailResult>
  verifyAuth(params: VerifyAuthParams): Promise<VerifyAuthResult>
  debug: DebugAdapter
  share?: ShareAdapter
  cache?: CacheAdapter
  generator?: GeneratorAdapter
  exportAllData?: (params: ExportAllDataParams) => Promise<ExportAllDataResult>
}

export interface ProbeResult {
  status: number
  json?: unknown
}

export type Probe = (path: string) => Promise<ProbeResult>

export interface DetectedBackend {
  kind: BackendKind
  capabilities: Capabilities
}
