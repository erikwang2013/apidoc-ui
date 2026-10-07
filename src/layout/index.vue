<template>
  <layout-header @reload-menu="onReloadMenu" />
  <loading-card v-if="state.loading" />
  <error-card
    v-else-if="appStore.globalError && appStore.globalError.response"
    :error="appStore.globalError"
  />
  <template v-else>
    <layout-sider ref="sider" />
    <layout-multitabs />
    <layout-content />
  </template>
</template>
<script setup lang="ts">
  import LayoutHeader from './header/index.vue'
  import LayoutSider from './sider/index.vue'
  import LayoutMultitabs from './multitabs/index.vue'
  import LayoutContent from './content/index.vue'
  import ErrorCard from '/@/components/ErrorCard'
  import { handleApidocHttpError } from '/@/utils/http/axios/handleError'

  import { useAppStore, useApidocStore } from '/@/store'
  import LoadingCard from '/@/components/LoadingCard'
  import useDevice from '/@/hooks/useDevice'
  import { ApiMenusParams } from '/@/api/apidocApi/types'
  import { useRoute, useRouter } from 'vue-router'
  const route = useRoute()
  const router = useRouter()
  const sider = ref()

  useDevice()
  // iframe 服务：接收同源 postMessage 调用 openTab 等事件（原 useWebsiteService）
  const websiteServiceEvents = {
    test: function (data) {
      console.log(data)
    },
    openTab: function (data) {
      // 仅允许 http/https 协议，防止 javascript:/data: 等注入
      const url = data.params && data.params.url
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return
      }
      router.push({
        name: 'IframePage',
        query: {
          url: url,
          title: data.params.title,
        },
      })
    },
  }
  window.addEventListener(
    'message',
    function (e) {
      // 只处理同源 postMessage，防止任意来源注入事件
      if (e.origin !== window.location.origin) {
        return
      }
      const event = e.data.event
      if (event && websiteServiceEvents[event]) {
        websiteServiceEvents[event](e.data)
      }
    },
    false,
  )

  const appStore = useAppStore()
  const apidocStore = useApidocStore()
  appStore.fetchFeConfig()
  appStore.setLang(route.query.lang as string)
  appStore.initTheme()
  appStore.initAppAuth()

  const state = reactive<{
    loading: boolean
    errorIframeUrl: string
  }>({
    loading: true,
    errorIframeUrl: '',
  })

  const params: ApiMenusParams = {
    appKey: route.query.appKey ? (route.query.appKey as string) : appStore.appKey,
    lang: route.query.lang ? (route.query.lang as string) : appStore.lang,
  }
  if (route.query.shareKey) {
    params.shareKey = route.query.shareKey as string
    appStore.setShareKey(route.query.shareKey)
  }

  appStore
    .fetchSeverConfig(params)
    .then(({ appKey, config }) => {
      apidocStore.fetchApiMenus({ ...params, appKey })
      apidocStore.fetchDocsMenus({ ...params, appKey })
      state.loading = false
      apidocStore.initGlobalParams(config)
    })
    .catch((error) => {
      handleApidocHttpError(error).then((res) => {
        if (res === false) {
          appStore.setGlobalError(error)
          state.loading = false
        } else {
          appStore.setGlobalError({})
          location.reload()
        }
      })
    })

  const onReloadMenu = () => {
    sider.value.onReload()
  }
</script>

<style lang="less" scoped></style>
