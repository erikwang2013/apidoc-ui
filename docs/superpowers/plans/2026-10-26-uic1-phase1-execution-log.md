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
| UI `npm run build` | pending; vite transform stalled on host I/O and was stopped before completion |
| PHP `tests/ui_contract.php` | pass |
| PHP `smoke/protocol/protocol_adapters/debug` | 26/169/55/260 pass |
| Go `go build ./server/uiapi ./server` | exit 0 |
| Go `go test ./server/uiapi` | pass |
| Rust `cargo check --features axum` | exit 0 |
| Rust `cargo check --features axum,debug-http,debug-session` | exit 0 |
| Rust `uic1_routes` test | first run 2/3; WS menu URL assertion fixed. Rerun blocked on cargo package-cache lock and was stopped |
| E2E three-backend script | not run yet |

## Host load note

The host was at load average 60-88 from other sessions during verification. Go linking and Rust dependency compilation repeatedly stalled at <1% CPU. The pending checks must be rerun before calling Phase 1 complete; no success is claimed for them.

## Follow-ups

1. Rerun UI `npm run build`, Rust `cargo test -p apidoc-rust --test uic1_routes --features axum`, and `cargo test --workspace`.
2. Add the E2E harness (`scripts/e2e-uic1.sh` + PHP demo router) and run it on an idle host.
3. Phase 2: share CRUD, cache management, generator, docs/export adapters, Rust share-scoped relay, Go/Rust `exportAllData`.
4. Phase 3/4 remain the multi-month executor and definition-parser work.
