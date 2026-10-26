# UIC-1 Phase 2b–5 Execution Log

- Date: 2026-10-26
- Scope: PHP declarative generator (2b), full L2 protocol union (3), external definitions (4), static Vue UI packaging (5).

## Delivered

| Repo | What landed | Main commit |
|---|---|---|
| UI | Phase 3-5 capability fixtures, E2E assertions, UI package script + manifest + upgrade guide, Phase 2b-5 plan | `d6ef565` |
| PHP | Declarative UIC-1 generator/code templates; 15 new protocol drivers (thrift, dubbo, http2, http3, kafka, amqp, xmpp, dnp3, iec104, bacnet, opcua, rtp, rtcp, rtmp, lwm2m); SSRF guard, TLS floors, parser caps; DNP3 IIN / BACnet prefix fixes | `3755dab` |
| Go | Relay sessions + HTTP/socket/RPC/finance/messaging/IoT/industrial/media executors (build-tag gated); grpc/http3; grpc reflection; full nine-format definition parser + UIC wiring; `UIPath` static UI; SSRF/limits/scope hardening | `839e03e` |
| Rust | Nine-format definition parser + UIC wiring + PHP golden parity; `ui`/`ui_path` Vue serving; DNP3/BACnet wire fixes; full compiled relay capability list | `3410444` |

## Verification (final trees)

| Check | Result |
|---|---|
| UI `npm test` | 43 passed / 10 files |
| UI `npm run build` | exit 0 |
| UI `npm run check:package-ui` | OK, deterministic sha256 |
| PHP `tests/smoke.php` | 26 passed |
| PHP `tests/protocol.php` | 205 passed |
| PHP `tests/protocol_adapters.php` | 55 passed |
| PHP `tests/debug.php` | 518 passed |
| PHP `tests/ui_contract.php` | OK |
| PHP `tests/performance.php` | PASS (p95 < 10ms) |
| Go `go test ./...` | all packages pass |
| Go `go test -tags apidoc_debug_all ./...` | all packages pass |
| Go race (uiapi + debug, tagged) | pass |
| Rust `cargo test --workspace` | pass |
| Rust `cargo test --workspace --features debug-all` | pass |
| Rust static_ui / uic1_routes / uic1_debug_scope (axum) | pass |
| Contract copies | 10 fixture files byte-identical in all four repos |
| E2E | PHP PASS, Go PASS, Rust PASS, `E2E: PASS` |

## Cross-backend semantics

- Protocol capabilities are per-backend compiled sets; Go uses build tags and advertises only compiled ids. PHP advertises available drivers (HTTP/3 omitted when curl lacks it). Rust advertises only compiled executors.
- Kafka/AMQP/XMPP are unary collect drivers on PHP/Rust; Go implements both unary and stream (capabilities authoritative). The UI handles both.
- Go gRPC supports unary with reflection/descriptor; streaming methods fail closed. Go HTTP/3 is real (quic-go) and tested fail-closed.
- Rust still has no declarative share actions (`actions:false`); cache is build-mode; generator is templates-only.
- PHP legacy `/generator` keeps side effects; `/ui/v1/generator` is in-memory declarative. PHP UIC share actions remain disabled.
- Go `UIPath` serves a packaged Vue build from the filesystem (no embed); Rust `ui=native|vue` + `ui_path`; library defaults stay native/off.
- HTTP/3 success path on PHP could not be exercised on this host (curl lacks HTTP3); unavailable path is tested.
- Real broker/device interoperability was not run; protocol tests use local mocks/golden vectors.

## Deferred / residual

- Rust truncated-IIN regression test (guard implemented; Go has it).
- Rust SIP IPv6/RTCP END/RTMP extended-timestamp parity fixes landed in Go only; Rust fixtures do not compare these bytes.
- BACnet segmented ComplexACK and directed broadcast untested; OPC UA security policies other than None are out of scope.
- Go external `$ref` target expansion after a pop matches PHP's limitation (N2); nested content-wrapper refs remain limited.
- Real GRPC/Kafka/AMQP/XMPP/DNP3/IEC104/BACnet/OPCUA/RTSP/SIP/RTMP interop and performance remain environment-gated.
- `getAllApiMenus` legacy read route remains app-wide; documented pre-existing behavior.

## Final status

Phase 2b–5 complete on `main` in all four repos. Phase 0–2 had already merged. Worktrees/branches remain until final review is signed off; no push was performed.

## Final integration review fixes

The final cross-repo review found four Important capability/test gaps; all were fixed and re-verified:

- Rust debug modes are derived from the compiled relay set (no relay modes on a feature-disabled build); `http2` now maps to the HTTP executor; `rust-phase1`/`rust-full` fixtures match real feature sets; a Rust test compares the debug-all capabilities to `rust-full`.
- Go `auth.global` now requires a non-empty password; `auth.app` reflects configured app passwords.
- PHP no longer advertises browser-only `hls` as relay-capable.
- E2E now serves the same `dist/uic1-ui` package from Go and Rust (`TestPackagedUIServed`, `packaged_ui_is_served_when_configured`) and verifies its manifest hash; `RESULT static-ui: PASS`.

Final merged commits: UI `6460eaf`, PHP `acced13`, Go `78c6e52`, Rust `7756c88`.

## Post-final resource-limit fix

A follow-up security review found parsed-row amplification from small DNP3/IEC104 frames (packed DNP3 points and IEC104 sequence ASDU rows were bounded only by wire bytes). Added hard caps in PHP, Go and Rust: DNP3 10,000 points per response (Go already had it; PHP/Rust added, plus a Rust u16 range-overflow fix) and IEC104 10,000 rows. Regression tests cover the caps.
