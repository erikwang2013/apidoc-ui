# UIC-1 Phase 2b–5 Execution Plan

> **For agentic workers:** Execute batch by batch. Use a fresh implementer per batch, independent review after each batch, and the same contract/E2E gates as Phases 0–2. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish the remaining UIC-1 parity program: PHP declarative generator (2b), full L2 protocol union on Go and PHP (3), eight external definition formats on Go and Rust (4), and Vue UI packaging for all three backends (5).

**Architecture:** Keep UIC-1 `{prefix}/ui/v1` envelopes and capability negotiation frozen. Port the Rust reference executors/parsers where they exist; keep protocol payloads declarative and server-side. Legacy routes stay untouched. Every capability advertised must be exercised by a test on that backend.

**Spec:** `docs/superpowers/specs/2026-10-25-multi-backend-parity-design.md`
**Program plan:** `docs/superpowers/plans/2026-10-25-multi-backend-parity-program.md`

## Global Constraints

- Work only in `/home/erik/worktrees/apidoc-uic1/{ui,php,go,rust}` on branch `feat/uic1-remaining`; never edit main checkouts or other sessions' artifacts.
- Contract canonical copy: `apidoc-ui/contract/`; after any contract change run `bash scripts/sync-contract.sh`, commit copies in all four repos, and run `node contract/check.mjs`.
- UIC-1 envelope `{code,message,data}`, success `code:0`; capabilities must be honest (advertise only wired features).
- Keep legacy PHP routes and legacy UI behavior intact.
- Security invariants: global/admin tokens for management; app/share scope checks on every relay/session; SSRF target guard; request/response/frame limits; no passwords, share secrets, or token material in responses/logs; feature-disabled paths fail closed.
- Go executors are build-tag gated so the default `go build` dependency graph stays unchanged; aggregate tag `apidoc_debug_all`.
- PHP new drivers register through `DebugRegistry` and add `ProtocolCatalog` defaults; no controller growth.
- Rust parsers must be pure functions: no network, no filesystem reads beyond the provided content, size/depth caps.
- Every batch ends with the repo's full test command plus the UIC-1 contract/E2E suites.

## Phase 2b — PHP Declarative Generator

**Outcome:** `/ui/v1/generator` and `/ui/v1/renderCodeTemplate` render configured templates without side effects; legacy `/generator` keeps writing files/tables.

**Files:** `php/src/Controller.php`, `php/src/ui/UiCapabilities.php`, `php/src/generator/*`, `php/tests/ui_contract.php`, `php/tests/fixtures/*`.

- [ ] **2b.1** Expose configured `generator`/`code_template` descriptors from `/ui/v1/config` with configured template content loaded from allowlisted paths (no client-supplied path).
- [ ] **2b.2** Implement `uiGenerator`: resolve index, map request `files`/`form`/`tables` onto configured file specs, render each configured template with the existing `ParseTemplate` engine into memory, return `{files:[{name,path,content}]}`. No writes, model creation, middleware, or DB access.
- [ ] **2b.3** Implement `uiRenderCodeTemplate` declaratively: configured template allowlist, app-scoped auth, selected IDs filtered to the app, render to `{code}`.
- [ ] **2b.4** Capabilities: `generator.sideEffects=false`, forms/templates true only when configured; tests prove legacy generator still writes.
- [ ] **2b.5** Contract fixtures cover render + code-template with deterministic output; update PHP contract test.

## Phase 3 — L2 Full Union Executors

**Outcome:** Every protocol family below executes through UIC-1 `debugSend` (unary) or `debugStart/Poll/Stop` (stream) on Go and PHP; Rust remains the reference and gets only scope/session fixes found by the cross-backend fixtures.

Protocol union (canonical ids): `http,http2,http3,soap,graphql,jsonrpc,xmlrpc,odata,mcp,a2a,webhook,websocket,ws-binary,sse,socketio,webrtc,hls,grpc,thrift,dubbo,hessian,tcp,udp,raw,unix,mqtt,stomp,amqp,kafka,xmpp,coap,lwm2m,modbus,dnp3,iec104,bacnet,opcua,rtsp,sip,rtp,rtcp,rtmp,iso8583`.

**Batches:** 3a HTTP/RPC/finance; 3b messaging; 3c IoT/industrial/media. Batch capabilities are advertised only after that batch passes on all three (PHP/Go/Rust).

### Go

**Files:** new `server/uiapi/debug/*.go` (build-tag per family), `server/uiapi/debug.go`, `server/uiapi/read.go`, `server/uiapi/uiapi.go`, `apidoc.go`, `go.mod`, tests `server/uiapi/debug_*_test.go`.

- [ ] **3G.0** Session framework: `debugSend` unary, `debugStart`→session map→`debugPoll` (drain up to 100 msgs)→`debugStop`; 60s idle TTL, 4 sessions/token, 1000-frame and 1 MiB caps, app/share scope binding, target guard reused from HTTP relay. Follow `rust/crates/apidoc/src/uiapi/debug.rs` semantics.
- [ ] **3G.1** HTTP family: http/http2/http3/soap/graphql/jsonrpc/xmlrpc/odata/mcp/a2a/webhook via `debugSend`; browser ids stay browser modes.
- [ ] **3G.2** Sockets: tcp/udp/raw/unix + stream sessions.
- [ ] **3G.3** RPC: grpc, thrift, dubbo/hessian; iso8583 finance.
- [ ] **3G.4** Messaging: mqtt/stomp/amqp/kafka/xmpp.
- [ ] **3G.5** IoT/industrial: coap/lwm2m/modbus/dnp3/iec104/bacnet/opcua.
- [ ] **3G.6** Media: rtsp/sip/rtp/rtcp/rtmp; hls boundary browser.
- [ ] **3G.7** Capabilities per batch; `debug.browser`/`debug.relay` lists match actually wired ids; error paths `ok:false` with reason.
- [ ] **3G.8** Tests mirror Rust `debug_*` fixtures with local mock servers; SSRF/limits/feature-disabled/scope tests per batch.

### PHP

**Files:** `src/protocol/debug/Driver/*.php`, `DebugRegistry.php`, `ProtocolCatalog.php`, `src/Controller.php`, `src/ui/UiCapabilities.php`, `tests/debug.php`, `tests/protocol_adapters.php`, new fixtures.

- [ ] **3P.1** Batch 3a drivers: `thrift`, `dubbo`, `http2`, `http3` (curl version-gated; unavailable ⇒ debuggable false with reason); hessian/iso8583/grpc existing.
- [ ] **3P.2** Batch 3b: `kafka`, `amqp`, `xmpp` unary collect drivers (Rust parity; Go may advertise real stream sessions as a superset — capabilities are authoritative); MQTT/STOMP existing.
- [ ] **3P.3** Batch 3c: `dnp3`, `iec104`, `bacnet`, `opcua`, `rtp`, `rtcp`, `rtmp`; coap/lwm2m/modbus/rtsp/sip/hls existing (verify LwM2M).
- [ ] **3P.4** Map canonical protocol ids to specialized drivers in `ProtocolCatalog` rather than `raw`; keep raw fallback only where intended.
- [ ] **3P.5** Driver fields/defaults and UIC capabilities reflect wired drivers; unavailable extensions fail closed with an explicit reason.
- [ ] **3P.6** Tests per driver: frame encode/decode, unary/stream behavior, timeout/size limits, disabled feature, app/share scope through UIC.

### Rust

- [ ] **3R.1** No new executors; fix only cross-backend discrepancies found by the shared fixtures (capability ids, field names, error shape, limits).
- [ ] **3R.2** Keep feature-disabled behavior identical: `debug=[]`, relay ids absent, routes fail closed.

## Phase 4 — L4 Definitions

**Outcome:** Nine formats (`openapi,asyncapi,graphql,proto,wsdl,edmx,json-schema,json-rpc,xml-rpc`) produce the same `definitions/messages/validation` shape on PHP, Go, Rust for the shared fixtures.

### Go

- [ ] **4G.1** Add `model.Action` definition inputs (`protocol_definition` path/inline, sample) and a pure parser package under `parse/protocol/` with format detection mirroring PHP `ProtocolRegistry`.
- [ ] **4G.2** Port adapters in order: OpenAPI, AsyncAPI, JSON Schema, JSON-RPC, XML-RPC, GraphQL, WSDL, EDMX, protobuf. Size/depth caps and XML entity safety; no network `$ref`.
- [ ] **4G.3** Emit normalized `{format,source,operation,messages,validation}` with diagnostics `{path,line,severity,message}`; `definitions()` in `server/uiapi/read.go` uses parsed results.
- [ ] **4G.4** Copy PHP fixtures under `tests/fixtures/protocol/` and add Go tests for every format (success + error).
- [ ] **4G.5** UIC capabilities `protocolDefinitions=true` only for wired formats; detail/validation shape unchanged for annotation-only docs.

### Rust

- [ ] **4R.1** Add a `protocol_defs` module (feature-independent, pure) with the same nine adapters and normalized output; reuse `apidoc-idl` proto/thrift parsers where semantics match, but preserve PHP validation shape.
- [ ] **4R.2** Wire into `uiapi::detail`/`definitions` and native exports; caps for input size/depth, no network.
- [ ] **4R.3** Copy the same fixtures and add Rust tests (success + error) for all nine.
- [ ] **4R.4** Errors use identical `path/line/severity`; unknown format fails with a stable error code/message.

### PHP

- [ ] **4P.1** Freeze the existing adapter output as the reference; add missing diagnostic fields/normalization only, no behavior change to legacy.
- [ ] **4P.2** Ensure UIC-1 detail/validation uses the same shape and asyncapi export consumes it.

## Phase 5 — Static UI, Release, Migration

**Outcome:** Each backend can serve the same Vue build at `/apidoc`; upgrade docs published.

- [ ] **5G.1** Go `Config.UIPath` + `http.FileServer`/`embed`; library default off, release package default on; SPA fallback.
- [ ] **5R.1** Rust `ui = "vue"|"native"` config; release package defaults to Vue; native remains.
- [ ] **5U.1** UI `scripts/build-release.mjs` (or shell) copies `dist/` to each backend's expected asset dir with a version manifest; no source edits in backend.
- [ ] **5U.2** Docs: upgrade guide (legacy PHP→UIC-1, Rust native→Vue, Go external→embedded), version matrix, deployment notes.
- [ ] **5.3** E2E: start each backend with the built UI and fetch `/apidoc` index + one asset; assert same UI hash/version in all three packages.
- [ ] **5.4** Final contract freeze 1.0; legacy PHP routes remain.

## Verification

| Gate | Command |
|---|---|
| UI | `npm test && npm run build` |
| PHP | `php tests/smoke.php && php tests/protocol.php && php tests/protocol_adapters.php && php tests/debug.php && php tests/ui_contract.php` |
| Go | `go test -count=1 ./...` |
| Go debug tags | `go test -tags apidoc_debug_all ./server/uiapi` |
| Rust | `cargo test --workspace` and `cargo test --workspace --features debug-all` |
| Contract | `node contract/check.mjs`; copies byte-identical |
| E2E | `UIC1_PHP_PORT=<free> ./scripts/e2e-uic1.sh` |

## Review Focus

- Advertised protocol that returns `ok:false` or a generic raw echo instead of a real executor.
- SSRF/target guard bypass on new protocols; DNS rebinding, redirects, IPv6/Unix sockets.
- Session leaks: TTL, cap accounting, upstream close, share/app scope on poll/stop.
- Parser bombs: deep nesting, huge XML/JSON, entity expansion, `$ref` cycles, path traversal.
- Capability drift after adding formats/protocols; UI branches on backend kind instead of capabilities.

## Batch/Rollout

1. Parallel wave: PHP 2b + 3a, Go 3G.0–3G.3, Rust 4R, UI 5U.
2. Parallel wave: PHP 3b/3c, Go 3G.4–3G.8, Rust 4R tests/fixes, UI/Go/Rust Phase 5.
3. Go 4G; PHP 4P normalization; Rust 4R final.
4. Cross-repo E2E, independent reviews, fix waves, merge `feat/uic1-remaining` into each main, remove worktrees.
