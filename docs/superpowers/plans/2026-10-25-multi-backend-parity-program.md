# Multi-Backend Strict Parity Program Plan

> **For agentic workers:** This is the program-level plan. Implement phases only after the spec is approved. Detailed task-by-task plans are written per phase; Phase 0/1 has its own plan at `docs/superpowers/plans/2026-10-25-uic1-phase0-phase1.md`.

**Goal:** Make one apidoc-ui build serve PHP, Go and Rust with strict feature parity, via a shared UIC-1 contract and phased backend implementations.

**Architecture:** UIC-1 is a versioned HTTP/JSON contract under `{prefix}/ui/v1`, mirroring the UI's existing PHP-shaped models. PHP keeps legacy routes and adds UIC-1 aliases; Go and Rust implement UIC-1 natively. The UI gets a small adapter layer (UIC-1 + legacy PHP), capability negotiation, host-scoped tokens, and capability-driven feature gating.

**Tech Stack:** Vue 3 + TypeScript + Vite + Ant Design Vue (UI); PHP 8 (apidoc-php); Go 1.24 (apidoc-go); Rust 2024 + axum/actix (apidoc-rust).

**Spec:** `docs/superpowers/specs/2026-10-25-multi-backend-parity-design.md`

## Global Constraints

- UIC-1 namespace is `{API_PREFIX}/ui/v1`; envelope is `{code,message,data}`; success code is `0`.
- Contract is additive within major `1.x`; breaking changes require `2.0`.
- Legacy PHP routes (`/apiMenus`, `/apiDetail`, `/config`, `/verifyAuth`, `/debug*`) must keep working unchanged.
- UIC-1 auth uses plaintext password over HTTPS and `Authorization: Bearer`; legacy PHP keeps browser MD5 + body token.
- UI token cache keys must include host: `${host}|${scope}`.
- UIC-1 config returns the full `ConfigResult` shape; `generator[]` uses `table` (singular), request sends `tables`.
- Go executor code is behind build tags; the default Go build must not gain heavy dependencies.
- Rust UIC-1 relay accepts `global|app|share` scopes; native `/apidoc/debug` remains global-password-only; SSRF/limit/feature gates unchanged.
- L2 parity uses the PHP+Rust full union, not a subset.
- L4 parity covers all 8 PHP formats: OpenAPI, AsyncAPI, GraphQL SDL, protobuf, WSDL/XSD, OData EDMX, JSON-RPC, XML-RPC.
- Contract fixtures have one source of truth: `apidoc-ui/contract/`; backend copies are generated and CI-checked for drift.
- No cross-language sidecar. Go and PHP executors are implemented natively.
- Work in isolated git worktrees per repo. Three idle peer sessions exist for `apidoc-php`, `apidoc-go`, `apidoc-rust`; do not terminate or reuse their processes/artifacts. If a peer becomes active on the same repo, stop and report to the user.
- The existing UI working-tree deletion `.vscode/settings.json` is pre-existing; do not include it in commits.

## Review Focus

These are the input classes most likely to bite users; every one must have a test in the phase that owns it.

1. **Token host collision:** two hosts share an appKey; a token from host A must never be sent to host B.
2. **Old backend detection:** a legacy PHP backend without UIC-1 must still load through the legacy adapter, not show a blank screen.
3. **Capability lies:** a backend that advertises a feature but returns a different shape must fail closed with a clear error, not render partial data.
4. **Relay scope:** an app/share token must not debug an endpoint outside its scope, and must not bypass SSRF/limits.
5. **Large docs:** menus/detail must not force a full-document transfer on first paint; exportAllData is export-only.
6. **Rust build-mode cache:** clear/warm must return an explicit build-mode result and the UI must explain it, not pretend a runtime cache was cleared.

## Workstreams

| Workstream | Repos | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|---|---|---|---|---|---|---|---|
| Contract | UI | schemas/fixtures | consume | extend share/generator | extend debug | extend definitions | freeze 1.0 |
| UI adapter | UI | baseline | UIC-1 + legacy + auth + debug | capability gating + tools | relay drivers | definitions tab | packaging |
| PHP | PHP | test skeleton | ui/v1 read/auth/debug | share/cache/generator/docs/exports | missing executors | 8 parsers reference | static UI docs |
| Go | Go | test skeleton | ui/v1 read/auth/browser debug/model | share/cache/generator/docs | all executors (build tags) | 8 parsers | static UI |
| Rust | Rust | test skeleton | ui/v1 read/auth/debug sessions | share/cache/generator/docs | wrapper hardening | 8 parsers | static Vue UI option |
| Release | all | version matrix | canary | canary | canary | RC | GA |

## Phase Plan

### Phase 0: Contract Freeze and Baselines

**Outcome:** UIC-1 schemas/fixtures exist; all four repos have a green baseline and a contract-test entry point.

Tasks:
- Write `contract/uic-1.schema.json` and fixtures for capabilities/config/menus/detail/protocol/debug/share/generator/export.
- Add `scripts/sync-contract.sh` (UI) and copies in PHP/Go/Rust; CI drift check.
- Fix UI baseline issues found during research: stale `types/index.d.ts` import, `HOSTS` type mismatch, share `create_time/create_at` mismatch.
- Add minimal contract-test harnesses: PHP script, Go `_test.go`, Rust integration test, UI Vitest (or Node test) setup.
- Record baseline commands and outputs in the plan execution log.

Exit criteria:
- `npm run build` green.
- `go test ./...` green.
- `cargo test --workspace` green (or documented pre-existing failures).
- PHP `tests/smoke.php`, `tests/protocol.php`, `tests/protocol_adapters.php`, `tests/debug.php` green.
- Contract fixtures reviewed; no backend implementation yet.

### Phase 1: L0 + L1 + Rust L2

**Outcome:** One UI build connects to all three backends; docs, login, HTTP/WS/SSE debug work; Rust relay debug works; Go non-HTTP relay reports unsupported.

Tasks (detailed in the Phase 0/1 plan):
- UI: backend adapter layer, detection, UIC-1 adapter, legacy PHP adapter, host-scoped tokens, auth modal, capability gating, debug adapter.
- PHP: `/ui/v1` capabilities/config/menus/detail/docs/verifyAuth/debugSend|Start|Poll|Stop; Bearer auth; legacy preserved.
- Go: `/ui/v1` capabilities/config/menus/detail/docs/verifyAuth; protocol opts/events model additions; browser debug metadata; no relay yet.
- Rust: `/ui/v1` capabilities/config/menus/detail/docs/verifyAuth; debugSend wrapper; debugStart/Poll/Stop session manager over `stream_dispatch`; global/app scope (share scope lands with share records in Phase 2); legacy query token preserved.
- E2E: start PHP/Go/Rust demos and run the same UIC-1 request suite against each.

Exit criteria:
- Three backends pass Phase 1 contract fixtures.
- UI loads, logs in and debugs HTTP/WS/SSE on all three.
- Rust relay modes work with global and app tokens.
- Go non-HTTP protocols show an explicit capability reason.
- No legacy PHP regression.

### Phase 2: L3 Management and Exports

**Outcome:** Share CRUD, cache management, declarative generator, docs pages, exportAllData/AsyncAPI work across all three.

Tasks:
- PHP: implement `/exportAllData`; declarative share actions; `ui_generator` descriptors; docs config mapping.
- Go: file-backed share store + CRUD; cache clear/warm; `ui_generator` + text/template; docs pages; exportAllData.
- Rust: file-backed share CRUD; build-mode cache; generator descriptors; docs pages; exportAllData; AsyncAPI in UIC-1; share-scoped UIC-1 relay debug.
- UI: capability-driven ToolsMenu/ApiShare/Generator/CodeTemplate/cache; AsyncAPI exporter; share Swagger client-side; generator preview/download.

Exit criteria:
- L3 matrix green, except Rust cache explicitly reports `mode:"build"`.
- Exports md/pdf/openapi/postman/asyncapi/typescript work on all three.
- Share scope tests pass on all three.

### Phase 3: L2 Full Union Executors

**Outcome:** All protocols in the PHP+Rust union execute via UIC-1 on all three backends.

Batches:
- 3a: HTTP/2/3 + HTTP family + WS/SSE + TCP/UDP/Unix + gRPC + Thrift + Dubbo/Hessian + ISO8583.
- 3b: MQTT + STOMP + AMQP + Kafka + XMPP.
- 3c: CoAP/LwM2M + Modbus/DNP3/IEC104/BACnet/OPC UA + RTP/RTCP/RTSP/SIP/RTMP + HLS boundary.
- PHP additions: thrift/dubbo/kafka/amqp/xmpp/dnp3/iec104/bacnet/opcua/rtp/rtcp/rtmp/http2/http3.
- Go additions: all families, build-tag gated.
- Rust: no new executors expected; UIC-1 session/scope hardening.

Exit criteria per batch:
- Protocol fixtures pass on all three.
- SSRF, limits, timeout, feature-disabled behavior tested.
- Capabilities advertise the batch only when all three pass.
- A batch can ship independently; GA waits for all three batches.

### Phase 4: L4 Definitions

**Outcome:** All 8 external definition formats produce equivalent `definitions/messages/validation` on all three.

Tasks:
- Build external-file fixtures per format: one success + one error, with expected diagnostics.
- Port PHP parsers/adapters to Go and Rust, or implement equivalent parsers.
- Normalize error path/line/severity.
- UI ProtocolTab consumes the unified shape with no backend branch.
- AsyncAPI export consistency.

Exit criteria:
- 8/8 formats pass on PHP, Go, Rust.
- Error diagnostics match in path/line/severity.
- No UI backend branch remains in ProtocolTab.

### Phase 5: Static UI, Release, Migration

**Outcome:** Three backends can ship the same Vue UI; upgrade path is documented.

Tasks:
- Go `Config.UIPath` + file server/embed; release package points at Vue build.
- Rust `ui = "vue"|"native"`; release package defaults to vue; native remains available.
- UI release artifact copy script; version matrix.
- Upgrade guide: legacy PHP → UIC-1, Rust native UI → Vue UI, Go external UI → embedded Vue UI.
- Final contract freeze 1.0; deprecation policy for legacy PHP routes.

Exit criteria:
- Each backend's release package serves `/apidoc` as the same Vue UI.
- Upgrade guide tested on one example per backend.
- No legacy PHP route removed.

## Cross-Repo Coordination

### Branching and worktrees

- Create one worktree per repo for this program:
  - `apidoc-ui/.claude/worktrees/multi-backend`
  - `/home/wwwroot/erikwang2013/apidoc-php/.claude/worktrees/multi-backend`
  - `/home/wwwroot/bag/apidoc-go/.claude/worktrees/multi-backend`
  - `/home/wwwroot/bag/apidoc-rust/.claude/worktrees/multi-backend`
- Do not work directly in the main checkouts; three idle peer sessions exist for the backend repos.
- If a peer session starts modifying the same repo, stop and report the conflict to the user.

### Contract sync

- Canonical: `apidoc-ui/contract/`.
- `scripts/sync-contract.sh` copies to `apidoc-php/contract/`, `apidoc-go/contract/`, `apidoc-rust/contract/`.
- CI check: `git diff --exit-code -- contract/` after sync in each backend.

### Version matrix

| UIC-1 | UI | PHP | Go | Rust |
|---|---|---|---|---|
| 1.0 Phase 0 | current | 1.1.x legacy | 1.0.x legacy | 2.1.x legacy |
| 1.0 Phase 1 | next | 1.2 | 1.1 | 2.2 |
| 1.0 Phase 2 | next | 1.3 | 1.2 | 2.3 |
| 1.0 Phase 3 | next | 1.4+ | 1.3+ | 2.4+ |
| 1.0 GA | next | 2.0 | 2.0 | 3.0 |

Versions are indicative; the release manager pins exact tags after each phase.

## Test Strategy

| Layer | Command | Gate |
|---|---|---|
| UI build | `npm run build` | every UI task |
| UI unit | `npm test` (Vitest/Node harness added in Phase 0) | adapter/detection/token tests |
| PHP | `php tests/smoke.php && php tests/protocol.php && php tests/protocol_adapters.php && php tests/debug.php` | every PHP task |
| Go | `go test ./...` | every Go task |
| Rust | `cargo test --workspace` | every Rust task |
| Rust debug | `cargo check --features debug-all` | debug tasks |
| Contract | each backend's contract test | every contract-affecting task |
| E2E | `scripts/e2e-uic1.sh` starts three demos and runs the suite | Phase 1+ exit |

Security tests are mandatory for auth, share scope, relay scope, SSRF, token host isolation, and credential redaction.

## Program Risks and Decision Log

| Decision | Value | Consequence |
|---|---|---|
| Contract shape | Mirror existing UI/PHP models | Minimal UI churn; backend mapping is heavier |
| L2 scope | PHP+Rust full union | Multi-month Phase 3; Go and PHP both grow substantially |
| L4 scope | All 8 PHP formats | Multi-month Phase 4; 8 parser ports |
| Rust relay auth | app/share scopes in UIC-1 | Relax Core assertion for UIC-1 path; security review required |
| Cache parity | Rust build-mode no-op | UI must explain, not fake |
| Generator parity | Declarative preview only | PHP side-effect generator stays legacy |
| Static UI | Release packages default to Vue | Library defaults unchanged |

## Definition of Done (Program)

- UIC-1 1.0 is frozen and documented.
- Three backends pass the same contract suite and E2E suite.
- L0-L4 matrix is green; only the explicitly accepted semantic differences remain.
- Legacy PHP routes and UI behavior still work.
- Each backend release package serves the same Vue UI.
- Upgrade and version-matrix documentation is published.
- Security review signed off on Rust UIC-1 relay scope, share stores, token host isolation and SSRF behavior.
