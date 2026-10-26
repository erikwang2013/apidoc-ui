import type {
  BackendOverride,
  Capabilities,
  DetectedBackend,
  Probe,
  ProbeResult,
} from './types'

const PHP_LEGACY_CAPABILITIES: Capabilities = {
  contract: 'legacy',
  backend: 'php',
  version: '',
  features: {
    menus: true,
    detail: true,
    docs: true,
    protocolDefinitions: true,
    debug: {
      browser: ['http', 'websocket', 'sse'],
      relay: ['raw', 'http', 'mqtt', 'stomp', 'coap', 'modbus', 'iso8583', 'rtsp', 'sip', 'grpc', 'hessian', 'hls'],
      modes: ['browser-http', 'browser-websocket', 'browser-sse', 'relay-unary', 'relay-stream'],
    },
    share: { link: true, records: true, actions: true },
    cache: { manage: true, mode: 'server' },
    // Legacy PHP generator executes callables and may write files/tables.
    generator: { forms: true, templates: true, sideEffects: true },
    exports: ['md', 'pdf', 'openapi', 'postman', 'asyncapi', 'typescript'],
    auth: { global: true, app: true, shareToken: true },
  },
}

export class BackendDetectionError extends Error {
  constructor(
    message: string,
    readonly host: string,
    readonly prefix: string,
  ) {
    super(message)
    this.name = 'BackendDetectionError'
  }
}

const detectionCache = new Map<string, DetectedBackend>()

export const clearDetectionCache = () => detectionCache.clear()

const isCompatibleContract = (contract: unknown): contract is string =>
  typeof contract === 'string' && contract.split('.')[0] === '1'

const asCapabilities = (json: unknown): Capabilities | undefined => {
  const body = json as { code?: unknown; data?: unknown } | undefined
  if (!body || body.code !== 0 || typeof body.data !== 'object' || body.data === null) {
    return undefined
  }
  const data = body.data as Capabilities
  if (!isCompatibleContract(data.contract)) return undefined
  if (!['php', 'go', 'rust'].includes(data.backend)) return undefined
  if (!data.features || !data.features.debug) return undefined
  return data
}

const isLegacyPhp = (probe: ProbeResult): boolean => {
  if (probe.status === 200) return true
  if (probe.status !== 401 && probe.status !== 402) return false
  const code = (probe.json as { code?: unknown } | undefined)?.code
  return [4001, 4002, 4005].includes(Number(code))
}

export interface DetectOptions {
  host: string
  prefix: string
  override?: BackendOverride
  probe: Probe
}

/**
 * Detect the backend for one host. `probe` receives a path relative to the
 * API prefix and must return the HTTP status and parsed JSON body.
 */
export async function detectBackend(options: DetectOptions): Promise<DetectedBackend> {
  const { host, prefix, override = 'auto', probe } = options
  const cacheKey = `${host}|${prefix}|${override}`
  const cached = detectionCache.get(cacheKey)
  if (cached) return cached

  if (override === 'php') {
    const detected = { kind: 'php-legacy' as const, capabilities: PHP_LEGACY_CAPABILITIES }
    detectionCache.set(cacheKey, detected)
    return detected
  }

  const capabilities = asCapabilities((await probe('/ui/v1/capabilities')).json)
  if (capabilities && (override === 'auto' || override === capabilities.backend)) {
    const detected = { kind: 'uic' as const, capabilities }
    detectionCache.set(cacheKey, detected)
    return detected
  }
  if (override === 'go' || override === 'rust') {
    throw new BackendDetectionError(
      `expected UIC-1 backend "${override}", got "${capabilities?.backend ?? 'none'}"`,
      host,
      prefix,
    )
  }

  if (isLegacyPhp(await probe('/config'))) {
    const detected = { kind: 'php-legacy' as const, capabilities: PHP_LEGACY_CAPABILITIES }
    detectionCache.set(cacheKey, detected)
    return detected
  }

  throw new BackendDetectionError(
    'no compatible backend found (expected UIC-1 capabilities or legacy PHP /config)',
    host,
    prefix,
  )
}

export { PHP_LEGACY_CAPABILITIES }
