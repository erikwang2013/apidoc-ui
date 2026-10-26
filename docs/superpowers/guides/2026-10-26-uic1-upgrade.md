# UIC-1 UI 升级指南（2026-10-26）

本指南说明如何把三套后端切换到同一份 Vue UI 构建，并覆盖：

- 旧版 PHP 专用 UI → UIC-1（自动探测，legacy PHP 继续可用）
- Rust 原生 UI → Vue UI（`ui: UiMode::Vue` / `ui_path`）
- Go 外部 UI → 内置静态 UI（`UIPath`；Phase 5G.1 待落地，见 §5）

设计背景见 `docs/superpowers/specs/2026-10-25-multi-backend-parity-design.md` 第 5.10 节，
发布脚本见 `scripts/package-ui.sh`，后端实现见 UIC-1 Phase 5（5G.1 / 5R.1 / 5U.1）。

## 1. 升级前必须知道的三件事

1. **一份构建，三端共用。** `apidoc/` 产物不包含任何后端代码；后端只负责在 `{PREFIX}/`
   下提供 `index.html`、`config.js`、`assets/*`。
2. **协议是 UIC-1 contract 1.0。** UI 启动时先请求
   `GET {PREFIX}/ui/v1/capabilities`；返回 200 且 `contract` 主版本为 `1` 时使用 UIC-1
   适配器，否则回退到 legacy PHP `GET {PREFIX}/config`。能力由后端如实声明，UI 按能力
   显示入口，不会因为后端是 Go/Rust 就写死分支。
3. **静态资源允许独立升级。** UI 与后端可以分别回滚；同一份 UI 包可以同时部署到
   PHP、Go、Rust 三个站点，manifest 中的 `sha256` 应完全一致。

## 2. 打包与部署路径

在 UI 仓库执行：

```bash
npm run package:ui                       # 构建并产出 dist/uic1-ui/
npm run package:ui -- --dest /srv/apidoc # 额外复制到目标目录
SKIP_BUILD=1 npm run package:ui          # 复用已有 apidoc/ 产物
npm run check:package-ui                 # 校验重复打包哈希与复算哈希一致
```

脚本要求 **bash ≥ 4.4** 与 **GNU coreutils**（`sha256sum`、`sort -z`、`xargs -0`）；
macOS 需安装 GNU coreutils。目标目录必须 **为空**，或包含上一次 `uic1-ui` 包的
`manifest.json`（`name` 为 `uic1-ui`）；脚本拒绝覆盖任何其他非空目录。

产物目录 `dist/uic1-ui/` 的内容（包括但不限于）：

```text
index.html
favicon.ico
style.css
config.js
config.js.gz / config.js.br
assets/…
utils/…
manifest.json
```

`manifest.json` 字段：

| 字段        | 含义                                                                 |
| ----------- | -------------------------------------------------------------------- |
| `version`   | 打包时 `package.json` 的版本（当前 3.3.0）                           |
| `name`      | 固定 `uic1-ui`                                                       |
| `builtAt`   | **打包时间**（UTC，ISO 8601），不是资源构建时间                      |
| `gitCommit` | **打包时** UI 仓库提交，未重新构建时不保证等于产物构建提交           |
| `sha256`    | 所有打包文件按相对路径排序后的内容哈希，不含 manifest 自身           |

`SKIP_BUILD=1` 会复用已有 `apidoc/`，脚本会先校验 `apidoc/index.html` 的
`config.js?v=<version>` 与 `package.json` 一致，不一致直接失败；但仍无法发现“版本号
未变、源码已改”的旧构建。此时 manifest 的 `version`/`gitCommit`/`builtAt` 只描述
本次打包的 checkout 与时间，不证明产物由该提交构建。正式发布应执行完整构建。

`sha256` 可复算：

```bash
cd dist/uic1-ui && find . -type f ! -path ./manifest.json -print0 \
  | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum
```

三端部署位置：

| 后端 | 放置位置                                            | 访问路径                          |
| ---- | --------------------------------------------------- | --------------------------------- |
| PHP  | 站点现有的 UI 目录（通常是 `public/apidoc/`）        | `{站点}/apidoc/`                  |
| Go   | `Config.UIPath` 指向的目录（Phase 5G.1 待落地）      | `{Prefix}/`（默认 `/apidoc/`）    |
| Rust | `ui_path` 指向的目录，且 `ui: UiMode::Vue`           | `/apidoc/`                        |

注意：

- `config.js` 必须与 `index.html` 同目录；它是运行时配置，改完无需重新打包。
- 脚本只覆盖、不删除目标目录内容；部署新版本前先清空旧目录（或使用新的空目录），
  否则会残留旧哈希资源。从旧 UI 迁移时同样先整体备份并清空。
- UI 使用 hash 路由，刷新页面只需要 `index.html` 可访问，不依赖后端做深链重写。
- `config.js` 的 `HTTP.API_PREFIX` 必须与后端 `Prefix` 一致（默认 `/apidoc`）。

## 3. 旧版 PHP 专用 UI → UIC-1

旧 UI 只实现了 PHP legacy 接口。新 UI 的探测顺序是：

1. `BACKEND` 显式覆盖（`auto` | `php` | `go` | `rust`，默认 `auto`）；
2. `GET {PREFIX}/ui/v1/capabilities` 成功且 contract 兼容 → UIC-1；
3. 回退 legacy PHP `GET {PREFIX}/config` 成功 → legacy PHP 适配器；
4. 都失败 → 全局错误页（不会进入半可用状态）。

因此 **未升级的 PHP 后端可以直接使用新 UI，无需改后端**。要显式指定时，在
`config.js` 顶层配置（不是 `HTTP.BACKEND`；代码读取的是 `window.apidocFeConfig.BACKEND`）：

```js
window.apidocFeConfig = {
  BACKEND: 'auto', // auto | php | go | rust
  HTTP: {
    HOSTS: [], // 留空 = 同源
    API_PREFIX: '/apidoc',
  },
}
```

- `BACKEND: 'php'` 会**强制 legacy 适配器**，即使后端已支持 `ui/v1`。仅用于回滚或对照测试。
- `BACKEND: 'go'` / `'rust'` 要求 `capabilities.backend` 匹配，否则直接报错，不会回退。
- 升级 PHP 后端后保持 `auto` 即可，无需改 `config.js`。
- legacy 适配器保留旧 PHP 生成器的副作用能力；UIC-1 生成器是声明式、无副作用的子集，
  详见第 7 节。

确认后端是否已切换到 UIC-1：

```bash
curl -s https://example.com/apidoc/ui/v1/capabilities | head -c 400
# {"code":0,"data":{"contract":"1.0","backend":"php",...}}
```

## 4. Rust 原生 UI → Vue

Rust 此前在 `/apidoc` 提供 crate 内嵌的原生 UI（库默认 `UiMode::Native`）。UIC-1
Phase 5 新增 `UiMode::Vue`：

| 配置      | 类型             | 说明                                                       |
| --------- | ---------------- | ---------------------------------------------------------- |
| `ui`      | `UiMode`         | `UiMode::Native`（库默认）/ `UiMode::Vue`                  |
| `ui_path` | `Option<PathBuf>` | `UiMode::Vue` 时必填：含 `index.html`/`config.js`/`assets/` 的目录 |

显式配置：

```rust
use apidoc::{ApidocConfig, UiMode};

let cfg = ApidocConfig {
    title: "我的 API".into(),
    ui: UiMode::Vue,
    ui_path: Some("/srv/apidoc".into()), // package:ui 的 dist/uic1-ui/ 内容
    ..Default::default()
};
```

发布包入口（推荐）：`ApidocConfig::release("我的 API", "/srv/apidoc")` 等价于上面的
配置。**库默认仍是 `UiMode::Native`**，已有部署无需改动。

升级步骤：

1. `npm run package:ui -- --dest /srv/apidoc`；
2. 用 `ApidocConfig::release(...)`，或显式设置 `ui: UiMode::Vue` 与
   `ui_path: Some(...)`；
3. 重启进程，访问 `/apidoc/`，确认首页页脚版本与 `manifest.json` 一致；
4. 需要过渡时设 `ui: UiMode::Native`，原生 UI 与旧路由保持原样。

Vue 模式行为：

- `GET /apidoc` 返回 307 到 `/apidoc/`（构建产物使用 `./assets/...` 相对路径）；
- `/apidoc/`、`config.js`、`assets/*` 从 `ui_path` 读取；无扩展名的未知路径回退
  `index.html`（SPA 兜底）；
- API 路由优先级不变，未知 API 子路径返回 404，不落到 SPA 壳；
- `ui_path` 内路径限制、`..`/编码绕过/符号链接逃逸返回 404；缺 `index.html` 启动即报错；
- 缓存与生成器差异见第 7 节。回滚只需改回 `ui: UiMode::Native`。

## 5. Go 外部 UI → 内置静态 UI（Phase 5G.1 待落地）

> **状态：待落地。** 截至 2026-10-26，apidoc-go `feat/uic1-remaining`（`967100e`）
> 尚未实现 `Config.UIPath` 或 `embed.FS` 内置 UI（5G.1 在并行开发中）。本节是
> Phase 5 计划接口，**落地前不要据此修改生产配置**；当前 Go 部署继续使用外部 UI，
> 无需任何改动。

5G.1 计划行为（以实际发布代码为准）：

- `Config.UIPath`：字符串目录，含 `index.html`/`config.js`/`assets/`；为空表示不内置，
  库默认关闭，现有外部 UI 行为不变。
- 非空时在 `{Prefix}/`、`{Prefix}/config.js`、`{Prefix}/assets/*` 提供静态 UI，
  未知路径回退 `index.html`（SPA 兜底）。
- 官方发布包通过 `embed.FS` 默认内置同一份构建；库默认仍关闭。
- 仍使用外部 UI 的部署：保持 `config.js` 的 `HOSTS`/`API_PREFIX` 指向 Go 服务。
- 回滚（落地后）：清空 `UIPath` 并重启，回到纯文档 API 模式。

5G.1 合并后，本节需按实际字段名、类型、默认值校对，并补充可执行的配置示例。

## 6. 版本与兼容矩阵

| 场景                     | 后端要求                                            | UI 配置                            | 结果                          |
| ------------------------ | --------------------------------------------------- | ---------------------------------- | ----------------------------- |
| legacy PHP（未升级）     | 有 `GET {PREFIX}/config`                            | `BACKEND: auto` 或 `php`           | legacy PHP 适配器             |
| UIC-1 PHP/Go/Rust        | `ui/v1/capabilities`，contract `1.0`                | `BACKEND: auto`                    | UIC-1 适配器                  |
| Go 内置 UI（待 5G.1）    | 未落地；继续使用外部 UI                             | —                                  | 尚未可用                      |
| Rust Vue UI              | 含 5R.1 的版本，`ui: UiMode::Vue` + `ui_path: Some(...)` | 同源，`HOSTS: []`             | `/apidoc/` 直接打开           |
| Rust 原生 UI（回滚）     | `ui: UiMode::Native`（库默认）                      | 同源                               | 旧原生界面                    |

当前基线：**apidoc-ui 3.3.0 / UIC-1 contract 1.0**。同一 major 内契约只做加法；
UI 按能力降级，不按后端类型硬编码。后端发布版本以各自 CHANGELOG 为准。

## 7. 已知语义差异

这些差异是设计选择，不是升级故障：

1. **Rust 缓存是构建期物化。** Rust 在 `Core::build` 时生成文档、导出与 mock，
   运行期没有可清理/重建的缓存。`/ui/v1/cache/clear|warm` 返回
   `{ok:true, mode:"build", message:"build-time materialized"}`；UI 优先展示后端返回的
   `message`，因此用户看到的是英文 `build-time materialized`。中文“该后端文档在构建期
   物化，无需运行时清理或重建”只是 `message` 缺失时的本地兜底文案。改文档后需重新构建
   并重启。
2. **PHP 生成器有两套语义。** legacy 适配器继续使用旧 `/generator`，会执行 PHP
   代码、写源码文件甚至建表，能力为 `generator.sideEffects: true`；UIC-1 的
   `/ui/v1/generator` 只接受配置好的模板与表单，返回
   `{files:[{name,path,content}]}`，不写盘、不建表，`sideEffects: false`。
   `/ui/v1/renderCodeTemplate` 同样只返回 `{code}`。迁移到 UIC-1 后，需要落盘的场景
   由使用方自行保存返回内容。
3. **能力是诚实降级开关。** 后端未实现的功能会从 capabilities 中省略或置 false，
   UI 隐藏对应入口；这不是 UI 缺功能。排障时先看 `/ui/v1/capabilities`，不要按
   “PHP 应该有某入口”推断。
4. **鉴权 token 不跨端通用。** 三端 token 不要求字节一致，只要求 scope 语义一致；
   切换后端地址时 UI 按 host + scope 分开缓存 token，需要重新登录。
5. **导出位置不同。** UIC-1 的 Swagger/OpenAPI、Postman、AsyncAPI 由 UI 在客户端
   从归一化详情生成；Rust 原生 `/export`、Go `/export` 等保留，但不强制与 UI 输出
   字节一致。

## 8. 回滚

UI 与后端独立回滚，推荐顺序：先回滚 UI，再回滚后端配置。

1. **只回滚 UI**：保留上一份 `dist/uic1-ui/`（或旧 `apidoc/`），停止复制新文件并整体
   恢复旧目录；后端不需要动。旧 UI + 新后端时，新后端仍保留 legacy 路由（PHP）或
   可显式降级（Rust `UiMode::Native`；Go 内置 UI 5G.1 落地后清空 `UIPath`）。
2. **PHP**：把旧的 UI 目录放回原位置；如需强制 legacy 适配器，设 `BACKEND: 'php'`，
   验证后改回 `auto`。
3. **Rust**：设 `ui: UiMode::Native` 并重启，恢复原生 UI；`ui_path` 可保留。
4. **Go**：5G.1 落地后可清空 `UIPath` 并重启，恢复纯文档 API + 外部 UI；当前版本
   尚无该字段，保持外部 UI 即为升级前状态。
5. **数据**：本升级不修改文档数据、分享记录或缓存格式；回滚不需要数据迁移。

## 9. 升级验收

每个后端执行：

```bash
BASE=https://example.com/apidoc

# 1. 能力与 contract
curl -fsS "$BASE/ui/v1/capabilities"

# 2. 首页与 manifest
curl -fsS "$BASE/" | grep -q '<div id="app"'
curl -fsS "$BASE/manifest.json"

# 3. 至少一个 JS/CSS 资源（从 index.html 取实际哈希名）
asset=$(curl -fsS "$BASE/" | grep -o 'assets/[^"]*\.js' | head -1)
curl -fsS "$BASE/$asset" >/dev/null

# 4. config.js 同目录且可加载
curl -fsS "$BASE/config.js" | grep -q apidocFeConfig
```

三端对照 `manifest.json` 的 `version` 与 `sha256`；同一份包部署到三端时两者必须一致。
Go 的静态 UI 验收在 5G.1 落地后执行。若页面进入全局错误页，按第 3 节的探测顺序检查
`ui/v1/capabilities`，而不是只看浏览器控制台。

## 10. 相关文件

- `scripts/package-ui.sh` — 构建、打包、manifest、按 `--dest` 复制
- `scripts/check-package-ui.sh` — 重复打包哈希一致性与复算自检
- `npm run package:ui` / `npm run check:package-ui` — 脚本入口
- `public/config.js` — 运行时配置（`BACKEND`、`HTTP.HOSTS`、`HTTP.API_PREFIX`）
- `src/backend/detect.ts` — 探测与 legacy 回退规则
- `docs/superpowers/specs/2026-10-25-multi-backend-parity-design.md` — UIC-1 契约与静态 UI 设计
- `docs/superpowers/plans/2026-10-26-uic1-phase2b-5-execution.md` — Phase 5 验收项
