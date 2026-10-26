# apidoc 多后端严格对等设计

- 状态：草案，待评审。本文批准前不写实现代码。
- 日期：2026-10-25
- 涉及仓库：`apidoc-ui`、`apidoc-php`、`apidoc-go`、`apidoc-rust`
- 目标版本：UIC-1 契约 + UI 适配层 + 三后端分阶段补齐

## 1. 为什么做

`apidoc-ui` 在 README 与站点文档中已经声明是 PHP、Go、Rust 三套后端共用的文档前端，但代码只实现了 PHP 的接口契约：

- UI 固定调用 `POST /apiMenus`、`POST /apiDetail`、`GET /config`、`POST /verifyAuth`、`POST /debugSend|Start|Poll|Stop`（`src/api/apidocApi/index.ts:28-46`、`src/api/globalApi/index.ts:3-5`、`src/api/debugApi/index.ts:5-20`）。
- 鉴权默认在浏览器里 MD5 密码，token 放在请求 body/query（`src/components/VerifyAuth/VerifyAuthModal.vue:72`、`src/utils/http/axios/index.ts:48-73`）。
- Go 只提供 `GET /api/menus|protocols|detail|export` 与 `POST /api/login|app-login`，没有 `/config`、分享、缓存管理、生成器；并且在 v1.0.13 明确移除了内嵌 UI 与 `/api/debug/*`（`CHANGELOG.md:36-41`、`README.md:148-153`）。
- Rust 提供 `/apidoc/api.json`、`/auth`、`/export`、`/mock`、`/share`、`/generate`、`POST /debug`、`WS /debug/stream`，但没有分享 CRUD、运行时缓存、PHP 式生成器表单；它的 `/apidoc` 是自己的原生 UI。
- PHP 自身也有两个 UI 已调用的缺口：`/exportAllData` 与 `/exportSwagger` 没有注册路由（`src/providers/BaseService.php:13-36`），`exportAllData` 靠 UI 逐接口回退，分享页的 Swagger 导出实际不可用。

因此“共用前端”目前只是文档表述，不是可运行事实。本设计定义一个统一契约 UIC-1，并给出三后端和 UI 的分阶段实施计划。

## 2. 现状证据摘要

| 能力 | PHP | Go | Rust |
|---|---|---|---|
| 菜单 | `apiMenus`，含 controller/group/tag/author/menuKey | `/api/menus` 只有 id/title/sort | `api.json` 的 `endpoints` + `apps` |
| 详情 | `apiDetail`，字段拆分完整 | `/api/detail?id=`，params/responses 扁平 | 全量内嵌在 `api.json` |
| 配置/应用树 | `/config` 完整 | 无 | 只有 `api.json.config` 安全子集 |
| 鉴权 | MD5 密码，token 在 body/query；分享记录带密码 | HttpOnly Cookie + 应用 token header；不支持 query token | HMAC token，只能 `?token=`；支持应用密码 |
| 协议面板 | protocol/channel/debug/definitions/validation | protocol + `protocol_info` | protocol/protocol_opts/events |
| 浏览器调试 | HTTP/WS/SSE | 无 detail host/param 元数据 | 原生 UI 内置 |
| 服务端调试 | relay-unary / relay-stream | 设计上无执行器 | `POST /debug` + `WS /debug/stream`，多协议 feature-gated |
| 分享 | 记录 CRUD，文件存储 | 无 | 仅生成链接，无记录 |
| 缓存管理 | 文件缓存，clear/create | 自动响应缓存，无管理接口 | 构建期物化，无运行时缓存 |
| 生成器 | PHP 类/表单/文件/建表副作用 | 无 | 固定模板，无表单 |
| 文档页 | Markdown 文件树 | 无独立文档树 | 无独立文档树 |
| 导出 | UI 客户端生成；后端缺两个路由 | JSON/TS | md/ts/swagger/asyncapi |
| 静态 UI | 支持 public 目录 | v1.0.13 已移除 | 内嵌原生 UI |

这些差异决定了：**只改 UI 不可能做到严格对等**。严格对等必须统一契约，并在 Go/Rust 增加服务端实现。

## 3. 目标、非目标、反目标

### 目标

1. 一份 UI 构建产物可连接 PHP、Go、Rust 三套后端；启动时自动识别，`config.js` 可强制指定。
2. 三套后端最终都实现同一套 UIC-1 契约；UI 只依赖 UIC-1，不再写后端分支。
3. 严格对等以能力矩阵为准：文档、调试、分享、缓存管理、生成器、文档页、导出、鉴权、静态 UI 全部有入口且行为一致。
4. 现有 PHP 部署不破坏：旧接口保留，UI 对旧 PHP 提供 legacy 适配。
5. 过渡期能力协商：后端未实现的能力明确显示“未启用/原因”，不静默隐藏、不返回假成功。
6. 鉴权、调试、SSRF、凭据处理按现有安全红线执行。

### 非目标

- 不统一 PHP/Go/Rust 的注解语法或解析器实现。
- 不统一三端的缓存文件格式、分享文件格式或 token 加密格式。
- 不在 UI 里实现 MQTT/gRPC/TCP 等协议执行器。
- 不把 PHP 的任意 callable 分享动作、任意代码生成器原样搬到 Go/Rust。
- 不重写 PHP 现有公开接口。

### 反目标

- 为每套后端复制一份 UI。
- 用“隐藏按钮”冒充兼容。
- 后端缺能力时返回 `{ok:true}` 的空操作而不说明。
- 把 token 放进 URL 访问日志（新契约优先 `Authorization`）。
- 让 Go/Rust 依赖 PHP 进程或额外 sidecar 才能调试。

## 4. “严格对等”的定义

对等按 UI 可见能力分为五级：

| 级别 | 内容 | 判定 |
|---|---|---|
| L0 | 应用树、菜单、详情、JSON/TS 视图 | 三端同一 UI、同一字段语义 |
| L1 | 浏览器 HTTP/WS/SSE 调试 | 三端都可执行并展示响应 |
| L2 | 服务端中继调试（MQTT/gRPC/TCP…） | 三端同一模式、同一交互、同一结果形状 |
| L3 | 分享、缓存管理、生成器、代码模板、文档页 | 三端同一入口与工作流 |
| L4 | 协议定义解析、校验、AsyncAPI | 三端同一展示结构和校验结果 |

目标矩阵（✅ 目标，⚠️ 有明确语义差异，❌ 当前缺失）：

| 能力 | PHP | Go | Rust | 完成阶段 |
|---|---|---|---|---|
| L0 文档/菜单/详情/JSON/TS | ✅ | ✅ | ✅ | Phase 1 |
| L1 浏览器调试 | ✅ | ✅ | ✅ | Phase 1 |
| L2 服务端调试 | ✅ | ✅ | ✅ | Phase 1（Rust）/ Phase 3（Go） |
| L3 分享链接 | ✅ | ✅ | ✅ | Phase 2 |
| L3 分享记录 CRUD | ✅ | ✅ | ✅ | Phase 2 |
| L3 缓存管理 | ✅ | ✅ | ⚠️ 构建期物化 | Phase 2 |
| L3 生成器/代码模板 | ✅ | ✅ | ✅ | Phase 2 |
| L3 文档页 | ✅ | ✅ | ✅ | Phase 2 |
| L4 协议定义/校验 | ✅ | ✅ | ✅ | Phase 4 |
| L4 AsyncAPI | ✅ | ✅ | ✅ | Phase 2 |
| 静态 UI | ✅ | ✅ | ✅ | Phase 5 |

### L2 协议族矩阵（按“PHP+Rust 全并集”）

| 协议族 | 代表协议 | PHP 现状 | Rust 现状 | Go 现状 | 目标 |
|---|---|---|---|---|---|
| HTTP 族 | http/http2/http3/soap/graphql/jsonrpc/xmlrpc/odata/mcp/a2a/webhook | 部分（HTTP/1.1 relay；HTTP2 依赖 curl） | ✅ | ❌ | 三端 ✅ |
| 浏览器实时 | websocket/ws-binary/sse/socket.io/webrtc/hls | ✅ 浏览器 | ✅ 浏览器 | ✅ 模型补齐后 | 三端 ✅ |
| RPC | grpc/thrift/dubbo/hessian | 部分（grpc/hessian） | ✅ | ❌ | 三端 ✅ |
| Socket | tcp/udp/raw/unix | raw 兜底 | ✅ | ❌ | 三端 ✅ |
| 消息队列 | mqtt/stomp/amqp/kafka/xmpp | 部分（mqtt/stomp） | ✅ | ❌ | 三端 ✅ |
| IoT/工业 | coap/lwm2m/modbus/dnp3/iec104/bacnet/opcua | 部分（coap/modbus） | ✅ | ❌ | 三端 ✅ |
| 媒体/电信 | rtsp/sip/rtp/rtcp/rtmp | 部分（rtsp/sip/hls） | ✅ | ❌ | 三端 ✅ |
| 金融 | iso8583 | ✅ | ✅ | ❌ | 三端 ✅ |

“全并集”意味着 PHP 还要补 thrift/dubbo/kafka/amqp/xmpp/dnp3/iec104/bacnet/opcua/rtp/rtcp/rtmp/http2/http3，Go 要补全部；这是本计划最大的工程量，Phase 3 会按协议族拆成多个可独立验收的批次，不能压成一个里程碑。

### 语义差异（必须显式接受，不能假装没有）

1. **Rust 缓存管理**：Rust 的文档在 `Core::build` 时物化，运行期没有可清理/重建的缓存。UIC-1 的 `/cache/clear|warm` 返回 `{ok:true, mode:'build', message:'build-time materialized'}`，UI 显示“构建期物化，无需操作”。这是行为差异，不是缺失入口。
2. **生成器**：PHP 现有生成器会执行 PHP 类、写源码、甚至建表；UIC-1 只定义**声明式、无副作用**的模板渲染：表单 + 文件模板 + 表格数据 → 渲染结果。PHP legacy `/generator` 保留原有副作用能力；UIC-1 页面使用声明式子集。Go/Rust 只实现声明式子集。
3. **协议定义解析**：PHP 已支持 OpenAPI/AsyncAPI/GraphQL/protobuf/WSDL/OData/JSON-RPC/XML-RPC 等外部定义文件。Go/Rust 目前只有注解级 protocol/events。Phase 4 把外部定义解析移植到 Go/Rust；在此之前，L4 不判定为完成。
4. **Go 服务端执行器**：Go 当前设计明确不内置协议执行器。Phase 3 用 Go 原生实现（不引入 sidecar），按协议族分批交付；Phase 3 完成前 L2 在 Go 上不判定为完成。
5. **PHP 的任意分享动作**：PHP `handleApiShareAction` 可以执行任意 callable。UIC-1 只支持声明式 action（`{action, params}`），PHP 适配器把已配置的 action 映射到声明式结果；任意代码能力保留在 legacy 接口。

## 5. UIC-1 契约

### 5.1 命名与版本

- 命名空间：`{API_PREFIX}/ui/v1`，默认 `{prefix} = /apidoc`。
- 响应包络：`{ code: 0, message: "ok", data: ... }`；失败 `{ code: <业务码>, message: "..." }`，HTTP 状态与业务码分离，沿用 PHP 现有习惯。
- 版本：`GET /ui/v1/capabilities` 返回 `contract: "1.0"`。同一 major 只做加法；破坏性变更升 major。
- 编码：JSON UTF-8；二进制调试载荷用 `{encoding:"utf8|hex|base64", data:"..."}`。

### 5.2 能力协商

`GET /ui/v1/capabilities` → `data`：

```json
{
  "contract": "1.0",
  "backend": "php",
  "version": "1.1.0",
  "features": {
    "menus": true,
    "detail": true,
    "docs": true,
    "protocolDefinitions": true,
    "debug": {
      "browser": ["http", "websocket", "sse"],
      "relay": ["mqtt", "stomp", "grpc", "tcp", "udp", "unix", "coap", "modbus"],
      "modes": ["browser-http", "browser-websocket", "browser-sse", "relay-unary", "relay-stream"]
    },
    "share": { "link": true, "records": true, "actions": true },
    "cache": { "manage": true, "mode": "server" },
    "generator": { "forms": true, "templates": true, "sideEffects": false },
    "exports": ["md", "pdf", "openapi", "postman", "asyncapi", "typescript"],
    "auth": { "global": true, "app": true, "shareToken": true }
  }
}
```

UI 启动顺序：

1. `HTTP.BACKEND` 显式指定（`php|go|rust|auto`，默认 `auto`）。
2. `GET /ui/v1/capabilities`；200 且 `contract` 兼容 → UIC-1 适配器。
3. 404/非 JSON → 探测 legacy PHP `GET /config`；成功 → legacy PHP 适配器。
4. 都失败 → 全局错误页，提示“后端版本过旧或地址错误”，不进入半可用状态。

能力是过渡期的诚实降级开关；严格对等完成后仍保留，用于旧版本后端和部署诊断。

### 5.3 文档与菜单

沿用 UI 现有类型，服务端负责归一化：

| 方法 | 路径 | 请求 | 响应 `data` |
|---|---|---|---|
| GET | `/ui/v1/config` | `{appKey?,lang?,shareKey?}` | `ConfigResult` + `capabilities` |
| POST | `/ui/v1/menus` | `{appKey,lang?,shareKey?,token?}` | `{app,data:ApiMenuItem[],tags,groups}` |
| POST | `/ui/v1/detail` | `{appKey,path,lang?,shareKey?,token?}` | `ApiDetailResult` |
| POST | `/ui/v1/allApiMenus` | `{lang?,token?}` | 应用树（叶子含 `appKey,menuKey,children`） |
| GET/POST | `/ui/v1/docMenus` | `{appKey,lang?}` | `DocMenusItem[]` |
| POST | `/ui/v1/docDetail` | `{appKey,path}` | `{content}` |

`/ui/v1/config` 必须返回 UI 现有 `ConfigResult` 的完整形状（`src/api/globalApi/types.ts:9-20`）。`/ui/v1/capabilities` 始终免鉴权；`config` 在开启鉴权时可返回 401，UI 登录后带 Bearer 重试：

- `apps[]`：`{key,title,path,items?,host?,hasPassword?,groups?,params?,responses?}`。
- `host`：该应用调试时使用的绝对基址。Go/Rust 新增可选的 `publicHost` 配置；为空时 UI 使用当前页面 origin（同源部署），不为空时必须是绝对 URL。PHP 沿用现有值。
- `params/responses`：全局参数与响应模板；Go/Rust 无对应配置时为空数组/空对象，UI 正常降级。
- `generator[]`：每项字段与 UI 类型一致，是 **`table`（单数）**，不是 `tables`；请求 `/ui/v1/generator` 时才发送 `{index,form,files,tables}`。
- `code_template[]`、`cache`、`share`、`export_config` 按 5.6-5.8 的定义。
- `capabilities` 与 5.2 相同，避免启动时二次请求；`GET /ui/v1/capabilities` 仍保留给探测与诊断。

字段语义以 `src/api/apidocApi/types.ts` 为准，新增字段只做加法。关键映射：

- `menuKey`：稳定 ID。PHP 用现有 `urlencode(Class@method)`；Go 用现有 `Action.ID`；Rust 用 `base64url(protocol \0 method \0 url \0 title)`，在 UIC-1 层预计算，不改 `api.json` 字节。
- `ApiDetailResult`：`header/query/routeParam/param/responseSuccess/responseError` 由各后端按 `in` 字段拆分；`md` 为原始 Markdown；`responseSuccessMd/responseErrorMd` 可选；`protocol/channel/debug/definitions/validation` 按 5.5 生成。
- `paramType`：Go/Rust 无表单上传语义时省略；有文件参数时标记 `formdata`。
- `notDebug`：Rust `not_debug` 直接映射；Go 无对应注解时 false。
- 类型字符串：保留后端原值；UI 的 `codeHelper/json.ts` 已做容错，不在契约层改写。

### 5.4 鉴权

- `POST /ui/v1/verifyAuth`，请求 `{password, appKey?, shareKey?}`，**明文密码**，只在 HTTPS 下使用；响应 `{token, expire?}`。
- token：对 UI 不透明；推荐 HMAC-SHA256 + base64url，payload 至少含 `exp`、`scope`（`global|app:<key>|share:<key>`）。PHP 可复用现有 `Auth::createToken` 的 authcode 格式以降低迁移风险；三端不要求 token 字节一致，只要求 scope 语义一致。
- 传递：优先 `Authorization: Bearer <token>`；为兼容旧中间层，同时接受 body/query 的 `token`，但 UIC-1 新代码只发 header。
- 分享 token：同一格式，scope 为 `share:<key>`，可访问该分享范围。
- **中继调试的 scope**：UIC-1 的 `/debug*` 接受 `global|app:<key>|share:<key>` token，并校验目标端点/分享范围；Rust 原生 `/apidoc/debug` 仍只认全局密码。UIC-1 在 Rust 内直接调用 `stream_dispatch` 前完成 scope 校验，不绕过 SSRF 守卫、限额与执行器 feature gate。
- 兼容：legacy PHP 仍走 `/verifyAuth`（MD5/browser 侧）与 body token；UI legacy 适配器保留该路径。UIC-1 不再让浏览器做 MD5。
- 错误：401 未认证、403 无权限、404 分享不存在、429 限流；响应包络仍带 `code/message`。
- CORS：允许 `Authorization, Content-Type, X-Apidoc-App-Token`；`WITHCREDENTIALS` 时回显 Origin，不使用 `*`。

### 5.5 协议与调试

详情中的协议结构沿用现有类型：

```json
{
  "protocol": {"name":"mqtt","label":"MQTT","version":"","transport":"tcp","mode":"relay-stream","http":false,"debuggable":true,"debugReason":""},
  "channel": {"address":"mqtt://broker:1883/sensors/+","action":"subscribe","meta":{}},
  "debug": {
    "mode":"relay-stream",
    "driver":"mqtt",
    "relayEnabled":true,
    "debuggable":true,
    "fields":[{"name":"topic","type":"string","in":"target","require":true}],
    "defaults":{"target":"mqtt://broker:1883","payload":"{}"},
    "meta":{},
    "responseEncoding":"json",
    "hints":""
  },
  "definitions":[{"format":"asyncapi","source":"inline","operation":"subscribe","messages":[],"validation":{"ok":true,"errors":[],"warnings":[]}}],
  "validation":{"ok":true,"errors":[],"warnings":[]}
}
```

调试端点（与 UI 现有 relay 驱动一致）：

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| POST | `/ui/v1/debugSend` | `{appKey,path,input:{target?,headers?,query?,fields?,payload?,encoding?,timeout?},shareKey?,lang?}` | `{ok,status?,headers?,body?,encoding?,meta?,error?}` |
| POST | `/ui/v1/debugStart` | 同上 | `{ok:true,sessionId}` |
| POST | `/ui/v1/debugPoll` | `{sessionId,appKey?,shareKey?,lang?}` | `{ok,messages:[{time?,type?,body?,encoding?}],error?}` |
| POST | `/ui/v1/debugStop` | `{sessionId,...}` | `{ok:true}` |

约束（三端一致）：

- 服务端目标只能来自服务端注解/配置的 `debug.defaults`，客户端不能改 host/port；允许 scheme 白名单。
- SSRF 守卫：DNS 解析后逐 IP 校验、禁回环/私网/链路本地/CGNAT/云元数据、禁重定向/代理/CONNECT，除非显式配置。
- 限流：60 次/分钟；单次 timeout ≤ 30s；消息 ≤ 1 MiB；每会话最多 100 条/轮；会话 TTL 60s；自动续期一次。
- Rust 的 `debugStart/Poll/Stop` 在服务端包装其 `debug/stream` 会话；Go 在 Phase 3 实现执行器与会话管理；PHP 沿用 `DebugProxy`。
- 浏览器 WS/SSE 不需要后端执行器，但 `debug.fields` 与默认值由后端给出，防止 UI 自行猜测。

### 5.6 分享

UIC-1 沿用 PHP 语义，但把“任意 callable”收敛为声明式 action：

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| POST | `/ui/v1/addApiShare` | `{key?,name,type,appKeys?,apiKeys?,password?}` | `true` |
| POST | `/ui/v1/getApiShareList` | `{pageIndex?}` | `{total,data:[ShareRecord]}` |
| POST | `/ui/v1/getApiShareDetail` | `{key}` | `ShareRecord` |
| POST | `/ui/v1/deleteApiShare` | `{key}` | `true` |
| POST | `/ui/v1/handleApiShareAction` | `{key,index}` | `{action,params}` 或 `false` |

- `ShareRecord`：`{key,name,type:"all"|"app"|"api",appKeys?,apiKeys?,create_at,create_time}`；密码永不出现在响应。
- 存储：PHP 沿用现有文件；Go/Rust 新增可配置的数据目录，JSON 文件原子写入；三端不共享文件格式。
- 分享范围过滤在服务端完成：`appKey` 必须在 `appKeys` 内；`apiKeys` 用稳定 menuKey 比较。
- `handleApiShareAction` 的 action 由服务端配置声明，返回 `{action,params}`，UI 自行决定如何消费；不再执行任意代码。

### 5.7 缓存

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| POST | `/ui/v1/cache/clear` | `{}` | `{ok:true,mode:"server"|"build",message?}` |
| POST | `/ui/v1/cache/warm` | `{}` | 同上 |

- PHP：删除/重建文件缓存。
- Go：失效并重建内存响应缓存。
- Rust：`mode:"build"`，无操作并返回说明；UI 显示“构建期物化”。

### 5.8 生成器与代码模板

`/ui/v1/config` 的 `generator[]` 与 `code_template[]` 采用现有 UI 类型，但语义限定为：

- `generator[]`：`{name,title,form,files,table}`（`table` 单数，与 UI 类型一致）；`POST /ui/v1/generator {index,form,files,tables}` 只返回 `{files:[{name,path,content}]}`，不写磁盘、不建表。
- `code_template[]`：`{title,template,select_mode,multiple,form,language}`；`POST /ui/v1/renderCodeTemplate {appKey,template,selected,form}` → `{code}`。
- **PHP 现有生成器条目不进入 UIC-1**：它们会执行 PHP 中间件、写源码、建表。UIC-1 只读取新增的 `ui_generator[]` 声明式条目；legacy 适配器继续显示原生成器入口并保留副作用。
- UI 的 UIC-1 生成器增加结果预览与下载；legacy 生成器维持现有“成功提示”行为。
- Go：用 `text/template` 实现同一变量上下文；Rust：扩展现有 `codegen` 引擎；PHP：把可声明式的配置映射到 `ui_generator`。
- 任何需要执行宿主语言代码的模板能力不进入 UIC-1。

### 5.9 导出

- UI 继续在客户端从归一化详情生成 Markdown、PDF（打印）、OpenAPI、Postman；新增 AsyncAPI 生成器（从 protocol/channel/events 推导）。
- `POST /ui/v1/exportAllData {lang?,key?|appKey?}` → `{apiData: ExportAppNode[]}`，供批量导出和分享导出；PHP 本次补齐该路由（当前缺失）。
- `POST /ui/v1/exportSwagger {key?}` 可选；UI 优先客户端生成，分享页按钮改为客户端 OpenAPI，避免依赖 PHP 未实现路由。
- 后端原生导出（Rust `export?format=...`、Go `export?format=typescript`）保留，不强行统一。

### 5.10 静态 UI

- `GET {prefix}/` 返回 UI `index.html`；`{prefix}/assets/*`、`{prefix}/config.js` 静态服务。
- Go：新增 `Config.UIPath`（目录）或 `embed.FS` 构建标签；默认不启用，配置后挂载。
- Rust：新增 `ui = "vue" | "native"` 配置；`vue` 时服务构建产物，保留原生 UI 作为兼容选项。
- PHP：现有 public 目录方式不变。
- 发布脚本把 `apidoc-ui` 的 `apidoc/` 产物复制到各后端发布包；三端不共享构建缓存。

## 6. UI 适配层设计

### 6.1 模块

```text
src/backend/
  types.ts        BackendAdapter、Capabilities、RequestContext
  detect.ts       自动识别与 override
  http.ts         包络解包、错误分类、token 放置、重试
  uic.ts          UIC-1 适配器（三端统一）
  phpLegacy.ts    旧 PHP 适配器（现有行为）
  normalize.ts    menu/detail/protocol 的防御性归一化
```

`BackendAdapter` 最小接口：

```ts
interface BackendAdapter {
  kind: 'uic' | 'php-legacy';
  capabilities: Capabilities;
  config(params): Promise<ConfigResult>;
  menus(params): Promise<ApiMenusResult>;
  detail(params): Promise<ApiDetailResult>;
  docsMenus(params): Promise<DocMenusItem[]>;
  docDetail(params): Promise<{ content: string }>;
  verifyAuth(params): Promise<{ token: string; expire?: number }>;
  share?: ShareApi;
  cache?: CacheApi;
  generator?: GeneratorApi;
  renderCodeTemplate?: CodeTemplateApi;
  exportAllData?: ExportApi;
  debug: DebugApi;
}
```

### 6.2 请求层

- 保留现有 axios 实例给 legacy PHP；UIC-1 用同一实例但走适配器显式 `baseURL`、`API_PREFIX`、`Authorization`。
- 不再用“URL 字符串白名单”判断是否包络；由适配器声明 `unwrap`。
- 错误分类：`AUTH_REQUIRED`、`APP_TOKEN_REQUIRED`、`SHARE_NOT_FOUND`、`RATE_LIMITED`、`CAPABILITY_MISSING`；认证弹窗由适配器决定是否需要 MD5。
- 多 Host：检测结果按 `host` 缓存；切换 Host 重新探测；不同 Host 可有不同 backend。
- **token 必须按 host 隔离**：现有 `APP_AUTH` 只按 `appKey/shareKey/global` 存储，多 Host 同 appKey 会把 A 的 token 发给 B。UIC-1 的存储键改为 `${host}|${scope}`；legacy PHP 也按同一规则迁移一次。适配器切换 Host 时只读取当前 host 的 token。

### 6.3 组件改动

- `VerifyAuthModal`：调用 `adapter.verifyAuth`，不再硬编码 MD5。
- `ToolsMenu` / `ApiShare` / `Generator` / `CodeTemplate` / cache：按 `capabilities` 渲染；缺失时显示禁用项与原因。
- `apiDetail`：按 `detail.protocol.debuggable` 与 `capabilities.debug` 决定 Debug/Protocol tab；不再只看 `notDebug`。
- `DebugTab/ProtocolDebug`：relay 调用改为 `adapter.debug.*`；浏览器驱动不变。
- `collect.ts`：`exportAllData` 由适配器提供；缺失时保留逐接口回退。
- `types/index.d.ts`：修正指向不存在的 `store/modules/app/interface/FeConfig` 的导入；`HOSTS` 类型与 README 对齐。

### 6.4 兼容策略

- 旧 PHP（无 UIC-1）：`phpLegacy` 适配器完全保留当前行为，md5/token-in-body/固定路由。
- 新 PHP/Go/Rust：UIC-1。
- 不做 native Go/Rust 适配器，避免 UI 维护三套映射；映射放在各后端，便于用后端测试覆盖。

## 7. 各仓库实现

### 7.1 apidoc-php

1. 新增 `ui/v1` 路由，映射到现有 Controller 方法；保留旧路由。
2. `/ui/v1/capabilities`：按配置生成 features；`cache.mode = "server"`。
3. 补齐 `/exportAllData`（app 树 + 内嵌详情）与 `/exportSwagger`（或明确标记 deprecated，由 UI 客户端生成）。
4. UIC-1 鉴权：接受明文密码，签发/校验 HMAC token；legacy `/verifyAuth` 保持 MD5。
5. 分享：声明式 action 描述；保留 legacy callable 行为。
6. 生成器：把现有配置映射为声明式 `generator[]`/`code_template[]`；UIC-1 渲染不写盘。
7. 协议定义：沿用现有 `ParseProtocol` 输出，确保 `definitions/validation` 与 UI 类型一致；Phase 4 的 8 类外部定义格式以 PHP 为参考实现。
8. **L2 全并集补齐**：PHP 现有驱动只有 raw/http-relay/mqtt/stomp/coap/modbus/iso8583/rtsp/sip/grpc/hessian/hls；Phase 3 需要新增 thrift/dubbo/kafka/amqp/xmpp/dnp3/iec104/bacnet/opcua/rtp/rtcp/rtmp/http2/http3 等执行器。优先把驱动注册表做成可插拔结构，避免 Controller 继续膨胀。
9. 测试：`tests/smoke.php`、`tests/protocol.php`、`tests/protocol_adapters.php`、`tests/debug.php` 增加 UIC-1 契约用例；Phase 3 每族增加协议 fixture。

### 7.2 apidoc-go

1. 新增 `server/uiapi` 包，提供 `/ui/v1/*`；复用 `store`/`model`，不复制解析器。
2. 配置：`title/desc/apps` + `capabilities`；应用树从 `Store.Project()` 生成；`AppConfig` 增加可选 `PublicHost`。
3. **模型补齐（Phase 1 前置）**：Go 目前只有 `@protocol` + URL，没有 relay target/topic/service、`protocol_opts`、`events`。新增：
   - `Doc.ProtocolOpts map[string]string`，注解 `@protocol-opt key=value`；
   - `Doc.Events []DocEvent`，注解 `@event direction=in|out name=... type=... desc=... mock=...`；
   - `Action` 增加 `protocol_opts`、`events`；菜单派生 `protocolKey/protocolLabel/channelAddress`；详情派生 `channel/debug`。
   - 这些字段必须可 JSON 序列化，且不改变现有 `/api/*` 输出（只在 UIC-1 与新导出中使用）。
4. 菜单/详情：`Action.ID` 作为 menuKey；按 `Param.In` 拆分 header/query/path/body；`Response.Fields` 映射 responseSuccess/responseError；`Markdown` 映射 `md`（当前只渲染 HTML，需保留原文）。
5. 鉴权：UIC-1 明文 + HMAC token（Bearer）；保留 Cookie/app token 旧路径；CUC-1 的 `verifyAuth` 支持全局与应用密码。
6. 分享：新增文件存储的 share store 与 CRUD；声明式 action。
7. 缓存：`cache/clear|warm` 操作现有版本化缓存。
8. 生成器：声明式配置 + `text/template` 渲染；不写盘；只渲染 UIC-1 声明式条目。
9. 文档页：从 `Action.Markdown` 合成 `docMenus/docDetail`（每个 action 一个文档节点）。
10. 导出：`exportAllData`；UI 客户端生成 OpenAPI/Postman/MD/AsyncAPI。
11. 调试：Phase 1 提供浏览器模式元数据（`debug.mode=browser-*`）；Phase 3 增加执行器与会话管理。执行器按 Go build tag 分族（`apidoc_debug_*`），默认构建依赖树不变，`debug-all` 聚合，镜像 Rust 的 feature 设计。
12. 静态 UI：`Config.UIPath` + `http.FileServer`/`embed`；库默认不启用，发布包默认指向 Vue 产物。
13. 测试：golden JSON 契约测试；`go test ./...`。

### 7.3 apidoc-rust

1. 新增 `crates/apidoc/src/uiapi.rs`（axum/actix 共用 route_core），提供 `/ui/v1/*`。
2. 文档模型：从 `ApiDoc` 预计算菜单/详情索引；稳定 ID 不改 `api.json` 字节。
3. 鉴权：UIC-1 明文 + HMAC Bearer；legacy `?token=` 继续支持；应用密码 scope。
4. 分享：文件存储 CRUD + 声明式 action；保留 `/share` 链接生成。
5. 缓存：`mode:"build"` 的无操作端点 + 说明。
6. 生成器：将 `codegen` 模板暴露为声明式 `code_template[]`；如需表单，增加 `generator` 配置结构；渲染只返回文本。
7. 文档页：从 endpoint `md` 合成 docs 树。
8. 导出：`exportAllData`；保留原生 md/ts/swagger/asyncapi。
9. 调试：`debugSend` 包装 `POST /debug`；`debugStart/Poll/Stop` 不绕回自己的 WebSocket，直接在服务端建立会话并复用 `debug::stream_dispatch`（内存 session map，60s TTL，100 条/轮，1000 帧上限）。
10. 静态 UI：`ui = "vue" | "native"` 配置；库默认保留 native，发布包默认切 vue，升级行为写在发布说明。
11. 测试：`cargo test --workspace`；契约 golden 测试。

### 7.4 apidoc-ui

1. 新增 `src/backend/*` 适配层。
2. 启动流程改造：检测 → config → menus/detail/docs 全部走 adapter。
3. 鉴权弹窗与错误处理改造。
4. Debug relay 驱动改造为 adapter 调用。
5. 能力驱动的工具菜单/分享/生成器/缓存/文档页。
6. 客户端导出增加 AsyncAPI；分享页 Swagger 改为客户端生成。
7. 修复 `types/index.d.ts` 与 `HOSTS` 类型。
8. 测试：适配器单元测试（Vitest 或 Node 内置 test）；`npm run build` 必须通过。
9. 文档：README/config.js 增加 `BACKEND`、能力矩阵、部署说明。

## 8. 分阶段计划

### Phase 0：契约冻结与基线（2–3 天）

- 产出 UIC-1 JSON Schema 与 golden fixtures（菜单/详情/协议/调试/分享/生成器）。
- 修复 UI 基线构建问题（`types/index.d.ts`、`HOSTS`）。
- 建立三端契约测试骨架。
- 退出标准：三端都能跑现有测试；fixtures 评审通过。

### Phase 1：L0 + L1 + Rust L2（1–2 周）

- UI：适配层、检测、legacy PHP、UIC-1 适配器、认证、能力驱动。
- PHP：`ui/v1` 只读接口 + 鉴权 + capabilities。
- Go：`ui/v1` 文档/菜单/详情/鉴权 + 浏览器调试元数据。
- Rust：`ui/v1` 文档/菜单/详情/鉴权 + browser/relay 调试包装；中继支持全局/应用 scope，分享 scope 在 Phase 2 分享记录落地后接入。
- 退出标准：同一 UI 可连接三端；文档、登录、HTTP/WS/SSE 调试可用；Rust 中继调试（全局/应用 scope）可用；Go 非 HTTP 协议显示“不支持”原因。

### Phase 2：L3 管理能力 + 导出（1–2 周）

- PHP：`exportAllData`、声明式分享 action、生成器描述。
- Go：分享 CRUD、缓存 clear/warm、生成器、文档页、`exportAllData`。
- Rust：分享 CRUD、缓存 build-mode、生成器描述、文档页、`exportAllData`；分享记录落地后把 share scope 接入 UIC-1 中继调试。
- UI：分享/缓存/生成器/文档页入口按能力启用；新增 AsyncAPI 导出；分享 Swagger 改客户端。
- 退出标准：L3 矩阵除 Rust 缓存语义差异外全绿；导出四格式 + AsyncAPI 三端可用。

### Phase 3：L2 全并集执行器（多周，分批）

- 3a：HTTP/2/3、SOAP/GraphQL/JSON-RPC/XML-RPC/OData/MCP/A2A/Webhook、WS/SSE、TCP/UDP/Unix、gRPC、Thrift、Dubbo/Hessian、ISO8583。
- 3b：MQTT、STOMP、AMQP、Kafka、XMPP。
- 3c：CoAP/LwM2M、Modbus/DNP3/IEC104/BACnet/OPC UA、RTP/RTCP/RTSP/SIP/RTMP、HLS（浏览器/服务端边界按协议登记表）。
- 每批同时覆盖 Go 新增实现与 PHP 缺失实现；Rust 已有执行器只补 UIC-1 适配与会话包装。
- 每批：执行器 + SSRF/限流/超时 + `debugStart/Poll/Stop` 会话 + 契约测试 + 三端 capabilities 更新。
- 退出标准：三端 L2 协议族矩阵全绿；未编译/未启用的执行器返回明确原因，不返回假成功。

### Phase 4：定义解析与 L4 对等（多周）

- 以 PHP 为参考实现，把 OpenAPI、AsyncAPI、GraphQL SDL、protobuf、WSDL/XSD、OData EDMX、JSON-RPC、XML-RPC 八类外部定义解析移植到 Go/Rust。
- 建立同一组外部定义文件 fixtures（每个格式至少一个成功样例 + 一个错误样例），三端输出等价的 `definitions/messages/validation`。
- AsyncAPI 导出与协议事件一致。
- 退出标准：8 类 fixture 在三端全部通过；错误行号/路径/严重级别语义一致；UI ProtocolTab 展示无后端分支。

### Phase 5：静态 UI、发布与迁移（约 1 周）

- Go/Rust 静态 UI 服务/embed；发布脚本复制 UI 产物。
- 版本矩阵与升级说明；旧 PHP 兼容测试。
- 清理原生 UI 的默认入口（Rust 保留 native 选项）。
- 退出标准：三端 `/apidoc` 默认打开同一 Vue UI；发布包可独立部署。

## 9. 测试与验收

### 契约测试

- **唯一真源**：`apidoc-ui/contract/` 存放 UIC-1 的 JSON Schema + fixtures（capabilities、config、menus、detail、protocol、debug、share、generator、export）。
- Go/Rust/PHP 仓库各放一份由 `scripts/sync-contract.sh` 生成的副本；CI 校验副本与真源一致，避免四仓各自漂移。
- 三端各自读取同一 fixtures，断言响应字段（允许额外字段，不允许缺失/类型错误）。
- 错误码矩阵：401/403/404/413/429/500。

### 后端测试

- PHP：`php tests/smoke.php`、`php tests/protocol.php`、`php tests/protocol_adapters.php`、`php tests/debug.php`、`php tests/performance.php`。
- Go：`go test ./...`；新增 `server/uiapi` 契约测试。
- Rust：`cargo test --workspace`；`cargo check --features debug-all`；契约测试。
- UI：`npm run build`、`npm run lint:eslint`；适配器单元测试。

### 端到端

- 启动 PHP 测试服务、Go `example`、Rust `examples/axum_demo`，用脚本对三端跑同一组 UIC-1 请求。
- 浏览器手测：三端同一 UI 的菜单、详情、协议面板、调试、分享、生成器、导出。
- 安全：token 不落 URL（UIC-1）、SSRF 元数据地址拒绝、分享范围越权拒绝、限流生效。

### 性能

- 保持 PHP 10ms 本地响应预算、Rust p99 < 10ms、Go 缓存命中路径。
- UIC-1 菜单/详情不引入额外全量解析。

## 10. 验收标准

- Phase 1：三端 L0 + L1 可用；Rust L2 可用；Go 未支持协议有明确原因。
- Phase 2：L3 管理能力与导出全绿；Rust 缓存显示构建期语义。
- Phase 3：Go L2 与 PHP/Rust 对齐。
- Phase 4：L4 定义/校验对齐。
- Phase 5：三端可独立部署并默认服务同一 Vue UI。
- 全程：旧 PHP 路由不破坏；`npm run build`、`go test ./...`、`cargo test --workspace`、PHP 测试通过。

## 11. 风险与待确认

| 风险 | 影响 | 缓解 |
|---|---|---|
| L2 全并集执行器量大（Go 全量 + PHP 补 14 类） | Phase 3 周期不可控 | 按协议族拆批；每批独立 capabilities/验收；优先高频协议，但严格对等完成前不宣称 GA |
| Rust 无运行时缓存 | 缓存管理语义不同 | 明确 `mode:"build"`；UI 显示说明 |
| 生成器副作用 | 三端无法等价 | UIC-1 只做声明式；PHP legacy 保留原能力 |
| 8 类外部定义解析移植 | L4 周期长 | Phase 4 独立；同一外部文件 fixtures；逐格式验收 |
| Rust 中继鉴权放宽 | 安全边界变化 | UIC-1 scope 校验 + 保留 SSRF/限额/feature gate；原生 `/debug` 仍全局密码；安全评审单列 |
| 鉴权迁移 | 旧客户端/token 失效 | 新旧 token 并存；legacy 路由保留一个 major |
| CORS/Cookie | Go 旧鉴权跨域不可用 | UIC-1 用 Bearer；文档要求同源或正确 CORS |
| 大文档全量传输 | 首屏慢 | 菜单/详情分接口；`exportAllData` 仅导出时调用 |
| 四仓发布联动 | 版本错配 | capabilities 协商；旧后端明确报错；发布矩阵文档 |

### 工程量现实

本设计批准的是“严格全功能对等”，不是一次 UI 改版：

- Phase 1/2 可以按周交付，能让三端 UI 先跑起来。
- Phase 3（L2 全并集）和 Phase 4（8 类定义解析）是数月起算的独立工程，尤其 PHP 补 Kafka/AMQP/XMPP/Thrift/Dubbo/工业协议、Go 从零实现全部执行器。
- 在 Phase 3/4 完成前，UI 的三端能力矩阵会显示未完成项；这不是“兼容失败”，而是分阶段交付的诚实状态。
- 若希望更早 GA，需要把 L2/L4 的验收门槛下调（例如先核心集），那是一次独立的产品决策，不能由实现方默认。

### 需要产品确认的语义（本设计的建议）

1. Rust 缓存管理按“构建期物化”只读展示，不强行造一个无意义的运行时缓存。
2. UIC-1 生成器只做声明式、无副作用渲染；PHP 的建表/写源码能力留在 legacy。
3. Go/PHP 执行器用各自语言原生实现，不引入跨语言 sidecar。
4. 8 类外部定义解析在 Phase 4 完成，Phase 4 前不宣称 L4 完成。
5. Go/Rust 发布包默认服务同一 Vue UI；库默认行为保持不变（Go 不启用静态 UI、Rust 保留 native UI 开关）。
6. Rust UIC-1 中继支持 app/share scope；原生 `/apidoc/debug` 仍全局密码。安全评审必须覆盖该差异。

## 12. 构建者默认决定

- 契约镜像 UI 现有 PHP 形状，避免重写全部组件；`/ui/v1/config` 返回完整 `ConfigResult`。
- UIC-1 用 Bearer + 明文密码（仅 HTTPS）；legacy PHP 保留 MD5。
- token 存储键加 host 前缀，修复多 Host 同 appKey 的串号/泄漏。
- 分享记录用文件存储，三端格式不统一。
- UIC-1 生成器只接受声明式条目；PHP 现有副作用生成器留在 legacy。
- 导出优先客户端生成；后端原生导出保留。
- 能力协商不因严格对等而删除；用于旧版本与诊断。
- 不在 UI 做 native Go/Rust 适配；映射在各后端。
- Go 执行器用 build tag 分族，默认构建不变；PHP 驱动注册表改为可插拔。
- 契约 fixtures 的唯一真源在 `apidoc-ui/contract/`，三端用脚本同步并在 CI 校验。
- Go/Rust 的 `AppConfig` 增加可选 `PublicHost`；为空时调试基址取当前 origin。
