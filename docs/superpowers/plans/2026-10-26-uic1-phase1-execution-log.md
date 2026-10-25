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

## Host load note

The host was at load average 60-88 from other sessions during the first verification pass. Go linking and Rust dependency compilation repeatedly stalled at <1% CPU. A later idle window let the UI build, Rust tests and E2E complete. The E2E harness defaults to PHP port 18091 because 18081 is occupied by another session's server.

## Follow-ups

1. Phase 2: share CRUD, cache management, generator, docs/export adapters, Rust share-scoped relay, Go/Rust `exportAllData`.
2. Phase 3/4 remain the multi-month executor and definition-parser work.
3. Keep `scripts/e2e-uic1.sh` in CI with the `axum` feature matrix; default-feature `cargo test --workspace` does not exercise UIC-1 routes.
