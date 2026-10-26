import { defineStore } from 'pinia'
import piniaStore from '/@/store/index'
import { AppState, APP_THEME, APP_LANG, APP_AUTH } from './types'
import type { Capabilities } from '/@/backend/types'
import { authKey } from '/@/utils/helper/authKey'
import Cache from '/@/utils/cache'
import { getBackend } from '/@/backend/state'
import { ThemeEnum } from '/@/enums/appEnum'
import { ConfigParams } from '/@/api/globalApi/types'
import { FeConfig } from '/@/store/modules/app/types'
import { parseRouteKey } from '/@/utils/helper'
import { loadVoLteResourceList } from '/@/utils/helper/loadScript'
import { loadStyle } from '/@/utils/helper/loadStyle'

import { toggleTheme } from '@zougt/vite-plugin-theme-preprocessor/dist/browser-utils'
import { handleApps } from './helper'
import { useApidocOutsideStore } from '/@/store/modules/Apidoc/index'

declare const apidocFeConfig: FeConfig

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    title: 'Apidoc',
    theme: ThemeEnum.LIGHT,
    device: 'desktop',
    isOpenSide: false,
    sideWidth: 350,
    feConfig: {
      TITLE: 'Apidoc',
      LANG: [],
      HTTP: {},
    },
    multiTabs: [],
    appKey: '',
    serverConfig: {
      apps: [],
      cache: {},
    },
    appObject: {},
    lang: '',
    keepAliveKeys: [],
    appAuth: {},
    capabilities: undefined,
    globalError: {
      config: {} as any,
      isAxiosError: false,
      toJSON: () => {
        return {}
      },
      name: '',
      message: '',
    },
    keepPages: [],
    apidocHost: 'http://localhost:6999',
    shareKey: '',
  }),
  getters: {},
  actions: {
    fetchFeConfig() {
      this.feConfig = apidocFeConfig
      if (this.feConfig.LOAD_SCRIPTS && this.feConfig.LOAD_SCRIPTS.length) {
        loadVoLteResourceList(this.feConfig.LOAD_SCRIPTS)
      }
      loadStyle('./style.css')
    },
    initTheme() {
      const cacheTheme = Cache.get(APP_THEME)
      if (cacheTheme) {
        this.toggleTheme(cacheTheme === ThemeEnum.DARK)
      }
    },
    // Change theme
    toggleTheme(dark: boolean) {
      this.theme = dark ? ThemeEnum.DARK : ThemeEnum.LIGHT
      Cache.set(APP_THEME, this.theme)
      toggleTheme({
        scopeName: `theme-${this.theme}`,
      })
    },
    setLang(lang: string) {
      if (lang) {
        this.lang = lang
        Cache.set(APP_LANG, lang)
      } else {
        this.lang = Cache.get(APP_LANG)
      }
    },
    setDevice(device: string) {
      this.device = device
    },
    toggleOpenSide(flag: boolean) {
      this.isOpenSide = flag
    },
    setSideWidth(width: number) {
      this.sideWidth = width
    },
    setMultiTabs(data) {
      this.multiTabs = data
      this.keepAliveKeys = data.map((p) => parseRouteKey(p))
    },
    fetchSeverConfig(params: ConfigParams) {
      return new Promise((resolve, reject) => {
        getBackend()
          .config(params)
          .then((config) => {
            const apps = config.apps || []
            const { appObject, count } = handleApps(apps)
            this.appObject = appObject
            const apidocStore = useApidocOutsideStore()
            apidocStore.setDashboard({
              appCount: count,
            })

            document.title = (config.title as string) || this.title

            this.serverConfig = config
            if (params.appKey) {
              const activeApp = appObject[params.appKey]
              if (activeApp) {
                this.appKey = params.appKey
                resolve({
                  appKey: this.appKey,
                  config: this.serverConfig,
                })
                return
              }
            }
            if (apps.length) {
              this.appKey = Object.keys(appObject)[0]
            }
            resolve({
              appKey: this.appKey,
              config: this.serverConfig,
            })
          })
          .catch((err) => {
            reject(err)
          })
      })
    },
    setAppKey(appKey: string) {
      this.appKey = appKey
    },
    getApiHost() {
      const hosts = this.feConfig.HTTP.HOSTS
      if (hosts && hosts.length) {
        const cacheHost = Cache.get('HOST')
        const find = cacheHost ? hosts.find((item) => item.host === cacheHost) : undefined
        return (find || hosts[0]).host || 'same-origin'
      }
      return typeof window !== 'undefined' ? window.location.origin : 'same-origin'
    },
    getAppAuth(scope: string, host?: string) {
      return this.appAuth[authKey(host ?? this.getApiHost(), scope)]
    },
    initAppAuth() {
      const stored = Cache.get(APP_AUTH) || {}
      const host = this.getApiHost()
      const next: Record<string, string> = {}
      let migrated = false
      for (const key of Object.keys(stored)) {
        if (key.includes('|')) {
          next[key] = stored[key]
        } else {
          // Old tokens were not host-scoped; attach them to the current host once.
          next[authKey(host, key)] = stored[key]
          migrated = true
        }
      }
      if (migrated) {
        Cache.set(APP_AUTH, next)
      }
      this.appAuth = next
    },
    setAppAuth(scope: string, token: string) {
      const key = authKey(this.getApiHost(), scope || 'global')
      this.appAuth[key] = token
      Cache.set(APP_AUTH, this.appAuth)
    },
    setCapabilities(capabilities: Capabilities) {
      this.capabilities = capabilities
    },
    setGlobalError(error) {
      this.globalError = error
    },
    setKeepPages(pages) {
      this.keepPages = pages
    },
    addKeepPages(page) {
      this.keepPages.push(page)
    },
    setShareKey(key) {
      this.shareKey = key
    },
  },
})

export function useAppOutsideStore() {
  return useAppStore(piniaStore)
}
