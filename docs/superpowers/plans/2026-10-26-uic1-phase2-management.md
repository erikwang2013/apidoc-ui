# UIC-1 Phase 2 — Management Parity Plan

**Goal:** Add the L3 management features to all three backends and wire them into the UI: share records/auth, cache management, declarative generator/code templates, `exportAllData`, AsyncAPI export, plus the deferred M1/M4 hardening.

**Architecture:** Extend UIC-1 with the already-designed share/cache/generator/export shapes. Backends own persistence and authorization; the UI calls the adapter methods already defined in `BackendAdapter` (share/cache/generator/exportAllData) and falls back to legacy PHP APIs where no UIC-1 method exists.

**Tech Stack:** Vue 3 + TypeScript; PHP 8; Go 1.24; Rust + axum/actix.

**Spec:** `docs/superpowers/specs/2026-10-25-multi-backend-parity-design.md`

## Global Constraints

- Envelope `{code,message,data}`, success `code:0`; legacy PHP routes unchanged.
- Share passwords and backend secrets are never returned in responses or logs.
- UIC-1 share tokens are scoped; an app token or share token cannot read another app or share.
- Cache management is explicit: `{ok,mode:"server"|"build",message?}`.
- Rust `cache/clear|warm` returns `mode:"build"`; the UI must display the message, not fake a runtime clear.
- Generator UIC-1 is declarative and side-effect free; PHP legacy generator stays legacy and advertises `sideEffects:true`.
- `exportAllData` returns `{apiData:[ExportAppNode]}` with embedded details.
- M1: Rust UIC stream sessions cap sessions, purge expired sessions, cap frames/messages, and reject >1 MiB messages.
- Work only in `/home/erik/worktrees/apidoc-uic1/{ui,php,go,rust}`; no main checkouts, no other sessions.

## Task 1: Contract fixtures

**Files:** `contract/uic-1/fixtures/cache.json`, `share.json` (extend), `generator.json` (extend), `export.json` (extend), `capabilities.json`.

- Add cache clear/warm fixtures (`{ok,mode,message?}`).
- Extend share fixtures with a password share and a share-token request/response.
- Extend generator fixtures with declarative files and code-template render.
- Extend export fixtures with `exportAllData` app tree and AsyncAPI document.
- Keep all four copies byte-identical via `scripts/sync-contract.sh`.

## Task 2: PHP

**Files:** `src/Controller.php`, `src/providers/BaseService.php`, `src/ui/UiCapabilities.php`, `tests/ui_contract.php`, `tests/fixtures/ui_server.php`.

- Add `/ui/v1/addApiShare`, `getApiShareList`, `getApiShareDetail`, `deleteApiShare`, `handleApiShareAction`, `cache/clear`, `cache/warm`, `generator`, `renderCodeTemplate`, `exportAllData`.
- Share: delegate to `ApiShare`; implement plaintext share login in `uiVerifyAuth` correctly (token minted from the stored digest, as fixed in `9054c03`); return 501 for unsupported UIC generator side effects where appropriate.
- Cache: aliases to `cancelAllCache`/`createAllCache`, returning `{ok:true,mode:"server"}`.
- Generator: expose declarative `ui_generator` descriptors in `/ui/v1/config`; `POST /ui/v1/generator` renders files without writing disk/DB; keep legacy generator on legacy routes. Set `capabilities.generator.sideEffects=true` for PHP because the legacy generator exists.
- `exportAllData`: aggregate the app tree with embedded details for the current app/share; no per-leaf HTTP calls from the UI.
- Tests: contract fixtures + share token roundtrip + exportAllData shape; keep existing tests green.

## Task 3: Go

**Files:** `server/uiapi/*.go`, `server/uiapi/*_test.go`, `server/server.go`, `apidoc.go`, `model/model.go` if needed, `store/store.go` if needed.

- Share store: file-backed JSON under `Config.ShareDir` (default `filepath.Join(os.TempDir(),"apidoc-go-shares")`), atomic writes, mutex; records `{key,name,type,appKeys?,apiKeys?,password_hash,secret,create_at}`.
- Share CRUD endpoints; password hashing with existing `auth.CheckPassword`/SHA-256; never return password/secret.
- Share login: `/ui/v1/verifyAuth` accepts `shareKey` + password, validates, issues `auth.Issue(secret, ttl, "share:"+key)`; remove the Phase 1 501.
- Share guard: config/menus/detail/docMenus/docDetail/debug accept `shareKey`; verify `share:<key>`, load record, enforce `appKeys` and `apiKeys`; app data still requires appKey.
- Cache: `/ui/v1/cache/clear|warm`; clear/rebuild the existing `server` response cache via callbacks passed into `uiapi.Options`.
- Generator: `Config.Generator []GeneratorSpec` (forms/files/table), declarative text/template rendering; `/ui/v1/generator` and `/ui/v1/renderCodeTemplate`; no disk/DB side effects; add to `/ui/v1/config`.
- `exportAllData`: build the app tree with embedded detail responses.
- Capabilities: share records/actions true, cache manage true, generator forms/templates true, sideEffects false.
- Tests: share CRUD/auth/scope, cache endpoints, generator render, exportAllData, contract fixtures.

## Task 4: Rust

**Files:** `crates/apidoc/src/uiapi.rs`, `crates/apidoc/src/uiapi/debug.rs`, `crates/apidoc/src/uiapi/share.rs` (new), `crates/apidoc/src/lib.rs` if needed, tests.

- Share store: file-backed JSON under a configurable `APIDOC_SHARE_DIR` (default temp dir), atomic writes, mutex; record `{key,name,type,app_keys,api_keys,password_hash,secret,created}`; never serialize password/secret.
- Share CRUD endpoints; password hashing with SHA-256/HMAC helpers; share login issues a token signed with the per-share secret (`auth::auth_token(&record.secret, cfg)`); share guard verifies with `auth::auth_check_app(token, &record.secret, cfg)` and enforces app/api scope.
- Remove the Phase 1 501 for shareKey; add share scope to config/menus/detail/docs/debug.
- Cache: `/ui/v1/cache/clear|warm` returns `{ok:true,mode:"build",message:"build-time materialized"}`.
- Generator: expose `codegen` templates as `code_template[]`; `POST /ui/v1/renderCodeTemplate`; declarative file rendering only; no side effects.
- `exportAllData`: app tree with embedded detail; AsyncAPI at `/ui/v1/export?format=asyncapi` or include in `exports`.
- M1: UIC stream session cap (4), TTL reaper on start/poll, 1000-frame cap, 1 MiB message guard; tests.
- Capabilities: share records/actions, cache build-mode, generator templates; keep exports accurate.
- Tests: share CRUD/auth/scope, cache mode, generator, exportAllData, M1 limits, contract fixtures.

## Task 5: UI

**Files:** `src/components/ApiShare/ApiShare.vue`, `src/components/ApiShare/EditShare.vue`, `src/components/Generator/GeneratorModal.vue`, `src/components/CodeTemplate/CodeTemplateModal.vue`, `src/layout/header/ToolsMenu.vue`, `src/utils/apidocExport/*`, `src/backend/*`, tests.

- Wire share CRUD/list/detail/delete/action through `getBackend().share` when present; legacy fallback for `php-legacy`.
- Wire cache clear/warm through `getBackend().cache`; display `mode:"build"` message.
- Wire generator/code-template through `getBackend().generator`; UIC generator shows files preview/download; legacy generator keeps success toast.
- `collectDoc` uses `getBackend().exportAllData` when present, legacy fallback.
- Share Swagger export uses client-side `collectDoc({shareKey})` + `buildOpenApiJson`, not `/exportSwagger`.
- Add `buildAsyncApiJson(nodes,title)` and an AsyncAPI export menu item; include protocol/channel/events/definitions.
- Add UI test for host-isolated token provider and share adapter routing (M6).
- Capability gating: show share/cache/generator only when the corresponding capability is true; PHP legacy still works via legacy adapter.

## Task 6: E2E

**Files:** `scripts/e2e-uic1.sh`, `tests/fixtures/ui_server.php`, backend tests.

- Extend the PHP fixture server with share/cache/export routes.
- Add probes for share CRUD/login/scope, cache clear/warm, exportAllData, and (where supported) AsyncAPI.
- Run Go/Rust in-process suites for the new management endpoints.
- Keep PID/port cleanup and nonzero-on-failure behavior.

## Task 7: Re-review and closeout

- Independent scoped review of the Phase 2 diffs (security: share scope/password/secret, cache semantics, generator side effects, exportAllData data exposure).
- One fix wave; re-review; update execution log and ledger.
- Do not claim Phase 3/4 (Go executors, 8 definition parsers) as done; they remain separate programs.
