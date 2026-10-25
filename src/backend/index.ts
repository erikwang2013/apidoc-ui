import axios from 'axios'
import { useAppOutsideStore } from '/@/store/modules/app'
import { detectBackend } from './detect'
import { createBackendHttp } from './http'
import { createPhpLegacyAdapter } from './phpLegacy'
import { setBackend } from './state'
import { createUicAdapter } from './uic'
import type { BackendAdapter, BackendOverride, ProbeResult } from './types'

export { getBackend } from './state'

const joinUrl = (host: string, prefix: string, path: string) => {
  const base = (host || '').replace(/\/+$/, '')
  const cleanPrefix = `/${prefix.replace(/^\/+|\/+$/g, '')}`
  return `${base}${cleanPrefix}${path}`
}

export async function initBackend(override?: BackendOverride): Promise<BackendAdapter> {
  const appStore = useAppOutsideStore()
  const host = appStore.getApiHost()
  const prefix = appStore.feConfig.HTTP.API_PREFIX || '/apidoc'
  const selected = override ?? appStore.feConfig.BACKEND ?? 'auto'

  const probe = async (path: string): Promise<ProbeResult> => {
    try {
      const response = await axios.request({
        url: joinUrl(host, prefix, path),
        method: 'GET',
        timeout: 5000,
        validateStatus: () => true,
        withCredentials: appStore.feConfig.HTTP.WITHCREDENTIALS,
      })
      return { status: response.status, json: response.data }
    } catch {
      return { status: 0 }
    }
  }

  const detected = await detectBackend({ host, prefix, override: selected, probe })

  let adapter: BackendAdapter
  if (detected.kind === 'uic') {
    const http = createBackendHttp({ baseURL: host, prefix })
    adapter = createUicAdapter(http, detected.capabilities, {
      getToken: (scope) => appStore.getAppAuth(scope),
    })
  } else {
    adapter = createPhpLegacyAdapter(undefined, detected.capabilities)
  }

  setBackend(adapter)
  appStore.setCapabilities(adapter.capabilities)
  return adapter
}

export const resetBackend = () => setBackend(null)
