/**
 * 导出数据收集：按 app 范围遍历接口菜单 + 文档菜单。
 * 接口部分优先走一次性导出接口(exportAllData)：1 个请求返回整棵应用树、
 * 接口详情内嵌（后端 isParseDetail=true，字段与 getApiDetail 同源），
 * 避免逐接口请求触发服务端限流(429)；老后端无该路由(404/不存在)时
 * 自动回退逐叶 getApiDetail（shareKey 透传走分享过滤，见 axios 拦截器）。
 * 文档页量小，仍按原逻辑逐 app 拉取。
 */
import apidocApi from '/@/api/apidocApi'
import type {
  ApiDetailResult,
  ApiMenuItem,
  ApiMenusParams,
  ExportAllDataParams,
  ExportAppNode,
} from '/@/api/apidocApi/types'
import { getBackend } from '/@/backend/state'
import type { BackendAdapter } from '/@/backend/types'
import { useAppOutsideStore } from '/@/store/modules/app'

/** 导出用文档节点：kind='api' 为接口，kind='doc' 为文档页 */
export interface DocNode {
  kind: 'api' | 'doc'
  appKey: string
  appTitle: string
  /** 分组/目录 title 祖先链（自上而下） */
  group: string[]
  title: string
  method?: string
  url?: string
  detail?: ApiDetailResult
  content?: string
}

export interface CollectDocOptions {
  /** 应用范围：appStore.appObject 的 key（叶子应用，可能逗号拼接），决定文档页读取范围 */
  appScopes: string[]
  /** 分享页查看者：批量导出走 shareKey + 分享 token；文档读取透传 shareKey */
  shareKey?: string
  /** 属主分享记录导出：批量接口走 key（全局 token），文档按 appScopes 逐 app 读取 */
  key?: string
  lang?: string
}

/**
 * 属主分享导出的 app 范围：优先分享的 appKeys；api 类型且无 appKeys 时
 * 没有可安全导出的文档范围（返回空，跳过文档），其余空 appKeys 回退全部 app。
 */
export function ownerExportAppScopes(
  share: { type?: string; appKeys?: string[] },
  allAppKeys: string[],
): string[] {
  const appKeys = share.appKeys || []
  if (appKeys.length) return appKeys
  return share.type === 'api' ? [] : allAppKeys
}

/** 单批并发上限：回退路径专用，走慢一点避免触发服务端限流 */
const REQUEST_CONCURRENCY = 3
/** 块间停顿(ms)：让限流窗口有时间补充额度 */
const CHUNK_GAP = 200

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 限流(429)背压：指数退避 + 抖动后重试；其他错误与超限立即抛出 */
async function withRetry<T>(fn: () => Promise<T>, maxTry = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      const limited = error && error.response && error.response.status === 429
      if (!limited || attempt >= maxTry) throw error
      await sleep(300 * 2 ** (attempt - 1) + Math.random() * 200)
    }
  }
}

/** 从 axios/业务错误中提取可读信息 */
export function errMessage(err: any): string {
  const msg = (err && (err.response?.data?.message || err.data?.message || err.message)) || ''
  return msg || String(err)
}

/** 一次性导出接口对当前后端不可用（老版本无 exportAllData 路由） */
function bulkUnavailable(err: any): boolean {
  if (err && err.response && err.response.status === 404) return true
  return /not found|不存在/i.test(errMessage(err))
}

/**
 * title 不保证是字符串：后端 docblock 多行标题会解析成数组（如 ['波次管理','波次']），
 * 非字符串 title 会让 group 链带数组、json 导出 .trim() 崩溃。
 * 统一取首元素转字符串（侧边栏 Vue 渲染数组即首行优先的 join 效果）。
 */
function strTitle(t: any): string {
  if (typeof t === 'string') return t
  if (Array.isArray(t)) return t.length ? String(t[0]) : ''
  return t == null ? '' : String(t)
}

/** 递归收集叶子节点，ancestors 为容器节点 title 祖先链 */
function collectLeaves(
  list: ApiMenuItem[],
  ancestors: string[],
  sink: (leaf: ApiMenuItem, group: string[]) => void,
) {
  ;(list || []).forEach((item) => {
    const children = item.children || []
    if (children.length) {
      collectLeaves(children, item.title ? [...ancestors, strTitle(item.title)] : ancestors, sink)
    } else {
      sink(item, ancestors)
    }
  })
}

function leafTitle(leaf: ApiMenuItem): string {
  const t = leaf.title || leaf.name || leaf.url || leaf.path || ''
  return strTitle(t)
}

/** 应用树 → 接口 DocNode：叶子 app 带 appKey；其 children 即菜单树（详情内嵌在叶子节点上） */
function collectApiFromTree(
  appList: ExportAppNode[],
  titleOf: (appKey: string) => string,
): DocNode[] {
  const nodes: DocNode[] = []
  const walk = (list: ExportAppNode[]) => {
    ;(list || []).forEach((app) => {
      if (app.appKey) {
        const key = app.appKey
        const appTitle = app.title || titleOf(key) || key
        collectLeaves((app.children || []) as ApiMenuItem[], [], (leaf, group) => {
          if (!(leaf.url && leaf.method)) return
          nodes.push({
            kind: 'api',
            appKey: key,
            appTitle,
            group,
            title: leafTitle(leaf),
            method: Array.isArray(leaf.method) ? leaf.method.join('/') : leaf.method,
            url: leaf.url,
            detail: leaf as ApiDetailResult,
          } as DocNode)
        })
      } else {
        walk((app.children || []) as ExportAppNode[])
      }
    })
  }
  walk(appList)
  return nodes
}

/** UIC-1 后端的所有文档/详情读取都走适配器；老 PHP 保持原 legacy 接口。 */
const isUic = (backend: BackendAdapter) => backend.kind === 'uic'

const apiMenusOf = async (backend: BackendAdapter, base: ApiMenusParams) =>
  isUic(backend) ? backend.menus(base) : (await apidocApi.getApiMenus(base)).data

const apiDetailOf = async (backend: BackendAdapter, base: ApiMenusParams, path: string) =>
  isUic(backend)
    ? backend.detail({ ...base, path })
    : (await apidocApi.getApiDetail({ ...base, path })).data

const docMenusOf = async (backend: BackendAdapter, base: ApiMenusParams) =>
  isUic(backend) ? backend.docsMenus(base) : (await apidocApi.getDocMenus(base)).data

const docDetailOf = async (backend: BackendAdapter, base: ApiMenusParams, path: string) =>
  isUic(backend)
    ? backend.docDetail({ ...base, path })
    : (await apidocApi.getDocDetail({ ...base, path })).data

/** 逐叶拉取接口详情（exportAllData 不可用时的回退路径；shareKey 透传走分享过滤） */
async function collectApiByRequests(base: ApiMenusParams): Promise<DocNode[]> {
  const backend = getBackend()
  const appStore = useAppOutsideStore()
  const app = appStore.appObject[base.appKey!]
  const appTitle = (app && app.title) || base.appKey
  const nodes: DocNode[] = []
  const menusRes = await withRetry(() => apiMenusOf(backend, base))

  const apiLeaves: { leaf: ApiMenuItem; group: string[] }[] = []
  collectLeaves(menusRes.data || [], [], (leaf, group) => {
    if (leaf.url && leaf.method) apiLeaves.push({ leaf, group })
  })
  for (let i = 0; i < apiLeaves.length; i += REQUEST_CONCURRENCY) {
    const chunk = apiLeaves.slice(i, i + REQUEST_CONCURRENCY)
    const chunkNodes = await Promise.all(
      chunk.map(async ({ leaf, group }) => {
        const detail = await withRetry(() => apiDetailOf(backend, base, leaf.menuKey))
        return {
          kind: 'api',
          appKey: base.appKey,
          appTitle,
          group,
          title: leafTitle(leaf),
          method: Array.isArray(leaf.method) ? leaf.method.join('/') : leaf.method,
          url: leaf.url,
          detail,
        } as DocNode
      }),
    )
    nodes.push(...chunkNodes)
    await sleep(CHUNK_GAP)
  }
  return nodes
}

/** 单个 app 范围的文档页（带 path 的叶子） */
async function collectDocs(base: ApiMenusParams): Promise<DocNode[]> {
  const backend = getBackend()
  const appStore = useAppOutsideStore()
  const app = appStore.appObject[base.appKey!]
  const appTitle = (app && app.title) || base.appKey
  const nodes: DocNode[] = []
  const docMenusRes = await withRetry(() => docMenusOf(backend, base))
  const docLeaves: { leaf: ApiMenuItem; group: string[] }[] = []
  collectLeaves(docMenusRes || [], [], (leaf, group) => {
    if (leaf.path) docLeaves.push({ leaf, group })
  })
  for (let i = 0; i < docLeaves.length; i += REQUEST_CONCURRENCY) {
    const chunk = docLeaves.slice(i, i + REQUEST_CONCURRENCY)
    const chunkNodes = await Promise.all(
      chunk.map(async ({ leaf, group }) => {
        const res = await withRetry(() => docDetailOf(backend, base, leaf.menuKey || leaf.path!))
        return {
          kind: 'doc',
          appKey: base.appKey,
          appTitle,
          group,
          title: leafTitle(leaf),
          content: res.content,
        } as DocNode
      }),
    )
    nodes.push(...chunkNodes)
    await sleep(CHUNK_GAP)
  }
  return nodes
}

/** 基础请求参数（当前 app / 分享 key 走 payload 鉴权） */
function baseOf(appKey: string, shareKey: string | undefined, lang: string): ApiMenusParams {
  const base: ApiMenusParams = { appKey, lang }
  if (shareKey) base.shareKey = shareKey
  return base
}

/**
 * 收集全部导出内容。
 * 接口请求失败即 reject（message 可读，由调用方 toast）；文档按 app 容错，失败的 app 跳过。
 */
export async function collectDoc(options: CollectDocOptions): Promise<DocNode[]> {
  const appStore = useAppOutsideStore()
  const nodes: DocNode[] = []
  // 接口回退请求保持分享过滤；文档没有属主路由，属主导出按 app 用全局凭证读取，
  // 不能把 key 当 shareKey 校验（密码分享会 401）。
  const apiShareKey = options.shareKey || options.key
  const lang = options.lang !== undefined ? options.lang : appStore.lang

  // 接口部分：单 app 或分享记录行 → 1 次 bulk 请求拿全部接口明细；其余逐 app
  const singleOrShare = Boolean(apiShareKey) || options.appScopes.length === 1
  if (singleOrShare) {
    const bulkParams: ExportAllDataParams = { lang }
    if (options.key) bulkParams.key = options.key
    else if (options.shareKey) bulkParams.shareKey = options.shareKey
    else bulkParams.appKey = options.appScopes[0]
    const backend = getBackend()
    try {
      const res = await withRetry(() =>
        backend.exportAllData
          ? backend.exportAllData(bulkParams)
          : apidocApi.exportAllData(bulkParams).then((response) => response.data),
      )
      const titleOf = (appKey: string) => {
        const app = appStore.appObject[appKey]
        return (app && app.title) || ''
      }
      nodes.push(...collectApiFromTree(res.apiData || [], titleOf))
    } catch (error) {
      // 老后端无 exportAllData → 逐 app 逐叶回退
      if (!bulkUnavailable(error)) throw error
      for (const appKey of options.appScopes) {
        nodes.push(...(await collectApiByRequests(baseOf(appKey, apiShareKey, lang))))
      }
    }
  } else {
    for (const appKey of options.appScopes) {
      nodes.push(...(await collectApiByRequests(baseOf(appKey, apiShareKey, lang))))
    }
  }

  // 文档页：只有查看者导出带 shareKey（分享 token）；属主导出走 per-app 全局凭证。
  // 单个 app 读取失败（如受密码保护且无 app token）只跳过它的文档，不影响 API 导出。
  for (const appKey of options.appScopes) {
    try {
      nodes.push(...(await collectDocs(baseOf(appKey, options.shareKey, lang))))
    } catch (error) {
      console.warn(`[apidoc export] skip docs for app ${appKey}: ${errMessage(error)}`)
    }
  }

  // 按 app 归并分组：导出渲染按 appTitle 分节，接口与文档需保持同 app 相邻
  const byApp: Record<string, DocNode[]> = {}
  nodes.forEach((node) => {
    ;(byApp[node.appKey] = byApp[node.appKey] || []).push(node)
  })
  const ordered: DocNode[] = []
  Object.keys(byApp).forEach((key) => ordered.push(...byApp[key]))
  return ordered
}
