# Changelog

本项目记录所有值得注意的变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循语义化版本。

## [3.4.0] - 2026-10-26

### Added

- UIC-1 适配器：启动时探测 `{API_PREFIX}/ui/v1/capabilities`，一套 Vue 构建自动适配
  PHP / Go / Rust；未升级的 PHP 后端自动回退 legacy 适配器。
- 全协议调试：HTTP/WebSocket/SSE 浏览器直连，另有 40+ 协议经后端中继（单次与流式，
  按各后端实际编译能力显示入口）。
- 9 种外部协议定义解析：OpenAPI、AsyncAPI、GraphQL、Proto、WSDL、EDMX、JSON Schema、
  JSON-RPC、XML-RPC，统一输出定义、消息与校验结果。
- UIC-1 管理能力：接口分享、缓存管理（PHP/Go 运行时，Rust 构建期）、声明式生成器与
  代码模板，以及 Swagger/OpenAPI、Postman、AsyncAPI 导出。
- 共享 UI 打包：`npm run package:ui` 生成 `dist/uic1-ui/` 与 `manifest.json`
  （version / gitCommit / sha256），同一份包可部署到三端；附升级与回滚指南。
- 发布流程：`VERSION` 文件与 `.github/workflows/release.yml`（push main 自动打 tag 并
  创建 GitHub Release）。

### Fixed

- 配套后端协议中继与定义解析的安全加固：SSRF 目标校验、应用/分享作用域检查、
  请求/响应/帧大小上限、TLS 版本下限、解析深度与体积上限，以及 DNP3 10,000 点、
  IEC 104 10,000 行的解析行数硬上限。

### Changed

- README、升级指南、社交预览图对齐 3.4.0（UIC-1 Phase 5 完成，PHP / Go / Rust 三端）。
