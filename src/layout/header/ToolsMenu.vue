<template>
  <a-dropdown v-if="showGenerator || showCache || showShare || (appStore.appKey && canAnyExport)">
    <template #overlay>
      <a-menu @click="handleMenuClick">
        <a-sub-menu v-if="showGenerator" key="generator" :title="t('generator.title')">
          <a-menu-item v-for="(item, index) in appStore.serverConfig.generator" :key="index">{{
            item.title
          }}</a-menu-item>
        </a-sub-menu>
        <a-sub-menu v-if="showCache" key="cacheManage" :title="t('cache.manage')">
          <a-menu-item key="cancelAllCache">{{ t('cache.cancelAll') }}</a-menu-item>
          <a-menu-item key="createAllApi">{{ t('cache.createAllApi') }}</a-menu-item>
        </a-sub-menu>
        <a-menu-item v-if="showCodeTemplate" key="codeTemplate">{{
          t('codeTemplate.title')
        }}</a-menu-item>
        <a-menu-item v-if="showShare" key="apiShare">{{ t('apiShare.title') }}</a-menu-item>
        <a-sub-menu
          v-if="appStore.appKey && canAnyExport"
          key="exportDoc"
          :title="t('exportDoc.title')"
        >
          <a-menu-item v-if="canExportKind('md')" key="exportMarkdown">{{
            t('exportDoc.markdown')
          }}</a-menu-item>
          <a-menu-item v-if="canExportKind('pdf')" key="exportPdf">{{
            t('exportDoc.pdf')
          }}</a-menu-item>
          <a-menu-item v-if="canExportKind('openapi')" key="exportOpenapi">{{
            t('exportDoc.openapi')
          }}</a-menu-item>
          <a-menu-item v-if="canExportKind('postman')" key="exportPostman">{{
            t('exportDoc.postman')
          }}</a-menu-item>
          <a-menu-item v-if="canExportKind('asyncapi')" key="exportAsyncapi">{{
            t('exportDoc.asyncapi')
          }}</a-menu-item>
        </a-sub-menu>
      </a-menu>
    </template>
    <a-button>
      <AppstoreOutlined />
      <span v-if="appStore.device != DeviceEnum.MOBILE">{{ t('tools.title') }}</span>
      <DownOutlined />
    </a-button>
  </a-dropdown>
</template>

<script setup lang="ts">
  import { useAppStore } from '/@/store/modules/app'
  import { featureEnabled, generatorToolsVisible } from '/@/backend/gating'
  import { cacheFeedback } from '/@/utils/helper/cacheFeedback'
  import { getBackend } from '/@/backend/state'
  import { useI18n } from '/@/hooks/useI18n'
  import { MenuInfo } from 'ant-design-vue/lib/menu/src/interface'
  import { AppstoreOutlined, DownOutlined } from '@ant-design/icons-vue'
  import apidocApi from '/@/api/apidocApi'
  import { message, Modal } from 'ant-design-vue'
  import ConfirmModal from '/@/components/ConfirmModal'
  import { DeviceEnum } from '/@/enums/appEnum'
  import showApiShareModal from '/@/components/ApiShare'
  import { collectDoc, errMessage } from '/@/utils/apidocExport/collect'
  import {
    blobDownload,
    buildMarkdown,
    buildPrintHtml,
    openPrintWindow,
    renderPrintWindow,
  } from '/@/utils/apidocExport/render'
  import { buildOpenApiJson, buildPostmanJson, downloadJson } from '/@/utils/apidocExport/json'
  import { buildAsyncApiJson } from '/@/utils/apidocExport/asyncapi'

  const appStore = useAppStore()
  const can = (path: string) => featureEnabled(appStore.capabilities, path)
  // UIC-1 capabilities are authoritative; legacy PHP keeps its server-config enable flags.
  const isUic = computed(
    () => !!appStore.capabilities && appStore.capabilities.contract !== 'legacy',
  )
  const showGenerator = computed(() =>
    generatorToolsVisible(appStore.capabilities, appStore.serverConfig.generator),
  )
  const showCodeTemplate = computed(
    () => can('generator.templates') && !!appStore.serverConfig.code_template?.length,
  )
  const showCache = computed(
    () => can('cache.manage') && (isUic.value || !!appStore.serverConfig.cache?.enable),
  )
  const showShare = computed(
    () => can('share.records') && (isUic.value || !!appStore.serverConfig.share?.enable),
  )
  const canExportKind = (kind: string) => {
    const exports = appStore.capabilities?.features.exports
    return !exports || exports.includes(kind)
  }
  const canAnyExport = computed(() =>
    ['md', 'pdf', 'openapi', 'postman', 'asyncapi'].some(canExportKind),
  )

  const { t } = useI18n()

  type ExportKind = 'md' | 'pdf' | 'openapi' | 'postman' | 'asyncapi'

  const emit = defineEmits<{
    (event: 'reloadMenu'): void
  }>()

  // 防重入：导出期间再次点击忽略
  let exporting = false
  // 导出当前应用全部接口与文档（B 入口）
  const runExport = async (kind: ExportKind) => {
    if (exporting || !appStore.appKey) return
    exporting = true
    let win: Window | null = null
    const loadingKey = 'apidocExport'
    message.loading({ key: loadingKey, content: t('exportDoc.generating'), duration: 0 })
    try {
      // PDF：空白打印窗必须在 await 前同步打开，否则被浏览器弹窗拦截
      if (kind === 'pdf') {
        win = openPrintWindow()
        if (!win) {
          message.warning(t('common.exportError', { message: '弹窗被拦截，请允许后重试' }))
          return
        }
      }
      const nodes = await collectDoc({ appScopes: [appStore.appKey] })
      if (!nodes.length) {
        message.warning(t('common.notdata'))
        return
      }
      const app = appStore.appObject[appStore.appKey]
      const title = (app && app.title) || appStore.appKey
      if (kind === 'pdf') {
        renderPrintWindow(win, buildPrintHtml(buildMarkdown(nodes, title), title))
      } else if (kind === 'openapi') {
        downloadJson(`${title}-openapi.json`, buildOpenApiJson(nodes, title))
      } else if (kind === 'postman') {
        downloadJson(`${title}-postman.json`, buildPostmanJson(nodes, title))
      } else if (kind === 'asyncapi') {
        const doc = buildAsyncApiJson(nodes, title)
        if (!Object.keys(doc.channels || {}).length) {
          message.warning(t('exportDoc.asyncapiEmpty'))
          return
        }
        downloadJson(`${title}-asyncapi.json`, doc)
      } else {
        blobDownload(`${title}-apidoc.md`, buildMarkdown(nodes, title))
      }
    } catch (error) {
      message.error(t('common.exportError', { message: errMessage(error) }))
      if (kind === 'pdf' && win && !win.closed) {
        win.close()
      }
    } finally {
      exporting = false
      message.destroy(loadingKey)
    }
  }

  // 缓存操作：UIC-1 走适配器，mode:"build" 时如实展示构建期语义；老 PHP 保持原接口。
  const runCache = async (op: 'clear' | 'warm') => {
    const backend = getBackend()
    const fallback = op === 'clear' ? t('cache.cancelSuccess') : t('cache.createSuccess')
    if (!backend.cache) {
      const res =
        op === 'clear' ? await apidocApi.cancelAllCache() : await apidocApi.createAllCache()
      message.success(fallback)
      return res
    }
    const res = await backend.cache[op]()
    const feedback = cacheFeedback(res, fallback, t('cache.buildMode'))
    message[feedback.level](feedback.text)
    return res
  }

  const handleMenuClick = async (e: MenuInfo) => {
    const { keyPath, key } = e

    if (!(keyPath && keyPath.length)) {
      return
    }
    if (keyPath[0] == 'generator') {
      const index = Number(keyPath[1])
      const { default: showGeneratorModal } = await import('/@/components/Generator')
      showGeneratorModal({
        generatorIndex: index,
        onSuccess: () => {
          // console.log('success')
          emit('reloadMenu')
        },
      })
    } else if (key == 'cancelAllCache') {
      // 清除所有缓存
      Modal.confirm({
        title: t('cache.cancelAllConfirm'),
        okText: t('common.ok'),
        cancelText: t('common.cancel'),
        onOk() {
          return runCache('clear')
        },
      })
    } else if (key == 'createAllApi') {
      // 生成所有缓存
      ConfirmModal({
        title: t('cache.createAllConfirm'),
        async onOk() {
          return runCache('warm')
        },
      })
    } else if (key == 'codeTemplate') {
      const { default: showCodeTemplateModal } = await import('/@/components/CodeTemplate')
      showCodeTemplateModal({})
    } else if (key == 'apiShare') {
      showApiShareModal({})
    } else if (keyPath[0] == 'exportDoc') {
      const kind = {
        exportMarkdown: 'md',
        exportPdf: 'pdf',
        exportOpenapi: 'openapi',
        exportPostman: 'postman',
        exportAsyncapi: 'asyncapi',
      }[key] as ExportKind | undefined
      if (kind) runExport(kind)
    }
  }
</script>

<style lang="less" scoped></style>
