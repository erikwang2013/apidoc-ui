# UIC-1 Phase 1 Execution Log

- Date: 2026-10-26
- Scope: shared UIC-1 read/auth/debug endpoints + UI adapter. Phase 2 management features and Phase 3/4 parity are not in this change set.

## Delivered

| Repo | What landed |
|---|---|
| apidoc-ui | Backend detection, UIC-1 adapter, legacy PHP adapter, host-scoped tokens, adapter-driven bootstrap/detail/docs, capability gating, debug adapter bridge, AsyncAPI/export gating deferred |
| apidoc-php | `/ui/v1/*` read/auth/debug aliases, capabilities, plaintext password + Bearer, `DebugRegistry::names()`, legacy routes unchanged |
| apidoc-go | `/ui/v1/*` read/auth/docs, protocol opts/events annotations, browser debug metadata, Bearer auth, CORS Authorization header, UIC tests |
| apidoc-rust | `/ui/v1/*` read/auth/docs, stable endpoint IDs, scoped UIC auth, unary debug bridge, stream session scaffold, axum/actix routes, UIC route test |

## Contract decisions locked in Phase 1

- Go `appKey` is `"<app>|<version>"` for leaf apps; Rust `appKey` is the leaf `AppDoc.key` / `"default"`.
- Go/Rust `protocolDefinitions` is true for annotation-derived protocol/events; external definitions remain Phase 4.
- Go/Rust `exports` is empty in Phase 1; the UI hides export until Phase 2.
- Go `cache.manage` and `share.records` are false in Phase 1; Rust `cache.manage` is false until Phase 2 wires build-mode management.
- Rust Phase 1 server debug advertises unary only; the stream session bridge is scaffolded but `stream_dispatch` only supports WebSocket today.
- PHP UIC-1 reuses the existing opaque `Auth::createToken` format; token bytes are not shared across backends.
- UI tokens are keyed by `${host}|${scope}` and legacy keys are migrated once.

## Verification

| Check | Result |
|---|---|
| `node contract/check.mjs` | pass, 9 fixture files |
| UI `npm test` | 27 tests pass |
| UI `vue-tsc --noEmit` | exit 0 |
| UI `npm run build` | exit 0; 3968 modules, 2m30s; generated `types/components.d.ts` reverted |
| PHP `tests/ui_contract.php` | pass |
| PHP `smoke/protocol/protocol_adapters/debug` | 26/169/55/260 pass |
| Go `go build ./server/uiapi ./server` | exit 0 |
| Go `go test ./server/uiapi` | pass |
| Rust `cargo check --features axum` | exit 0 |
| Rust `cargo check --features axum,debug-http,debug-session` | exit 0 |
| Rust `uic1_routes` test | 3/3 passed after the WS menu URL fix |
| Rust `cargo test --workspace` | exit 0; 131 tests passed, 0 failed |
| E2E `scripts/e2e-uic1.sh` | PASS: PHP 7/7 probes, Go pass, Rust 3/3; server PID/port cleanup verified |

## Post-review security fixes

An independent review found 2 Critical and 5 Important gaps that the green tests did not cover. They were fixed and re-verified:

| Finding | Fix | Commit |
|---|---|---|
| C1 PHP share token minted from plaintext | mint from the stored md5 digest; add token-format test | PHP `9054c03` |
| C2 Rust native `/apidoc/debug` accepted app tokens | `Core::guard_global` used by native debug/stream | Rust `2a5b357` |
| I1 Rust UIC debug not bound to endpoint app | resolve endpoint first; guard/session use endpoint app key | Rust `2a5b357` |
| I2 Rust relay target client-controlled | target only from `protocol_opts["target"]` / `ep.url` | Rust `2a5b357` |
| I3 Go app-password-only bootstrap deadlock | public config bootstrap; protected app data still token-bound | Go `1416d6d` + `c61600e` |
| I4 Go empty appKey wildcard | require appKey for menus/docs; app tokens cannot cross apps | Go `1416d6d` |
| I5 Rust per-app public host missing | `APIDOC_PUBLIC_HOSTS` JSON map + `APIDOC_PUBLIC_HOST` fallback | Rust `2a5b357` |
| M2 Go/Rust shareKey ignored | explicit HTTP 501 envelope | Go `1416d6d`, Rust `2a5b357` |
| M3 Rust capability/detail relay mismatch | `executor_compiled(kind)` gates `debuggable`/relay list | Rust `2a5b357` |

Verification after fixes:
- E2E rerun: PHP 7/7, Go pass, Rust 3/3, `E2E: PASS`.
- Rust: `uic1_routes` 5/5, `uic1_debug_scope` 1/1, lib 36/36, all-targets 180 passed, workspace exit 0.
- PHP: `ui_contract` 16 PASS + existing 26/169/55/260.
- Go: `go test -count=1 ./server/uiapi ./server ./auth` pass.
- Scoped re-review: ALL ADDRESSED 9/9, no new Critical/Important in touched paths.
- Residual R1 (client `fields` could override dubbo `target`/rtsp `url`) fixed in Rust `8b90377`; lib tests 37/37, route/debug-scope tests 5/5 + 1/1.

Deferred (recorded, Phase 2): M1 stream session limits/rate caps/reaper; M4 PHP generator capability wording; M5 E2E breadth; M6 additional cross-cutting tests. Rust per-app host uses the env map instead of `AppConfig.public_host` to avoid breaking 52 public struct literals.

## Host load note

The host was at load average 60-88 from other sessions during the first verification pass. Go linking and Rust dependency compilation repeatedly stalled at <1% CPU. A later idle window let the UI build, Rust tests and E2E complete. The E2E harness defaults to PHP port 18091 because 18081 is occupied by another session's server.

## Follow-ups

1. Phase 2: share CRUD, cache management, generator, docs/export adapters, Rust share-scoped relay, Go/Rust `exportAllData`.
2. Phase 3/4 remain the multi-month executor and definition-parser work.
3. Keep `scripts/e2e-uic1.sh` in CI with the `axum` feature matrix; default-feature `cargo test --workspace` does not exercise UIC-1 routes.
