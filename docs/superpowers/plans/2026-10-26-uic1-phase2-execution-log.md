# UIC-1 Phase 2 Execution Log

- Date: 2026-10-26
- Scope: L3 management parity (share, cache, generator, export) + deferred M1/M4 hardening + M5/M6 coverage.

## Delivered

| Repo | What landed | Commit(s) |
|---|---|---|
| UI | Adapter-first share/cache/generator/export wiring, client-side share Swagger, AsyncAPI exporter, generator preview/download + side-effect warning, host-token/share-routing tests | `d334a06`, `0ae4b7b` |
| PHP | `/ui/v1` share/cache/generator aliases, `exportAllData`, side-effect-honest generator capability | `726bedd` |
| Go | File-backed share store + CRUD/login/scope, cache clear/warm, declarative generator + code templates, `exportAllData`, capabilities | `4abf2c2` |
| Rust | File-backed share store + CRUD/login/scope, build-mode cache, code-template exposure, `exportAllData`, M1 session limits, AsyncAPI native route | `8613b9a`, `2fdbfd1` |
| Contract | `cache.json`, share login, AsyncAPI export, capabilities target | `d334a06`, copies synced |
| E2E | PHP live management probes, Go management tests, Rust `uic1_management` | `e98a1f5` |

## Verification

| Check | Result |
|---|---|
| UI `npm test` | 33 tests pass (8 files) |
| UI `npm run build` | exit 0 |
| PHP `ui_contract` | 35 checks pass |
| PHP smoke/protocol/protocol_adapters/debug/performance | 26/169/55/260 pass + p95 < 10ms |
| Go `go test -count=1 ./...` | all 11 packages pass |
| Rust `uic1_management` | 1/1 pass |
| Rust `uic1_routes` / `uic1_debug_scope` | 5/5, 1/1 |
| Rust lib (debug features) | 47 passed |
| Rust workspace | all targets pass |
| E2E final | PHP 20/20, Go pass, Rust 5/5 + 1/1 + 1/1, `E2E: PASS` |
| Contract copies | 10 fixtures byte-identical across four repos |

## Post-review fixes

The independent Phase 2 review found 2 Critical + 5 Important + 1 new Important regression in the fix wave. All were fixed and re-verified:

| Finding | Fix | Commit(s) |
|---|---|---|
| C1 PHP exportAllData leaked app passwords | strip passwords in export/share payloads; legacy getAllApiMenus too; regression test | PHP `60b8507` |
| C2 PHP UIC management accepted app tokens | `requireAdmin` global-only on share/cache/generator/export-key endpoints | PHP `60b8507` |
| I1 UI share export sent share token to owner path | owner `{key}` uses global token, viewer `{shareKey}` uses share token | UI `a4195f3` |
| I2 exportAllData bypassed app passwords with empty body | protect/filter by app/share scope; mixed-auth tests | PHP/Go/Rust `60b8507`/`be33e6e`/`4ea4ba9` |
| I3 Rust code template ignored app scope | filter selected/empty by guarded app; cross-app tests | Rust `4ea4ba9` |
| I4 PHP UIC share action ran legacy callables | UIC returns false, `share.actions:false`; legacy route unchanged | PHP `60b8507` |
| I5 Rust session cap checked after upstream connect | reserve slot before `stream_dispatch`; test | Rust `4ea4ba9` |
| N1 PHP renderCodeTemplate over-gated | app-scoped again + configured-template allowlist | PHP `fcb11c3` |
| R1 password-share owner doc export failed | owner docs read per app without shareKey | UI `b038f65` |
| R2 legacy PHP management accepted app tokens | legacy management now requires global token | PHP `fcb11c3` |
| M2 AsyncAPI multi-message invalid | one channel per message, singular `message` | UI `a4195f3` |
| M5 Go capabilities advertised unwired controls | capabilities reflect CacheClear/Warm and ShareActions wiring | Go `be33e6e` |
| M6 Rust share password hash unsalted | HMAC-SHA256 keyed by record secret | Rust `4ea4ba9` |
| M7 public-share login diverged | all backends reject passwordless share login; tokenless reads remain | Go/Rust |
| M8 test gaps | PHP/Go/Rust/UI regression tests + E2E negative probes | all |
| M9 PHP share keys time-based | `bin2hex(random_bytes(16))` | PHP `60b8507` |

Final E2E after all fixes: **PHP 32/32, Go pass, Rust 5/5 + 1/1 + management 1/1, E2E PASS**.

## Accepted deviations

- **PHP generator remains legacy and side-effecting.** `/ui/v1/generator` aliases the legacy generator; capabilities advertise `sideEffects:true`; the UI shows a warning and keeps the legacy success flow. Declarative UIC-1 generator is Phase 2b.
- **PHP share actions remain legacy callables.** `/ui/v1/handleApiShareAction` executes configured PHP callables under admin auth, not the declarative `{action,params}` only. Flagged for security review.
- **Rust share actions false.** Rust has no declarative action config; `handleApiShareAction` returns false and capabilities advertise `actions:false`.
- **Rust per-app host** uses `APIDOC_PUBLIC_HOSTS` JSON env + `APIDOC_PUBLIC_HOST` fallback instead of `AppConfig.public_host`.
- **Go `auth.app`** is advertised as supported (`true`) rather than "configured"; no UI code reads it.
- **Rust public-share login** accepts a token request without a password check (public shares need no token for reads); PHP rejects that path. Password shares are checked.
- **Rust share store** serializes writers only within one process; multi-process writes to the same `APIDOC_SHARE_DIR` are last-writer-wins.
- **M5** is narrower than a three-live-server harness: PHP is a live `php -S` fixture; Go/Rust use their in-process route/management suites. The PHP fixture now covers share/cache/exportAllData.

## Deferred

- Phase 2b: declarative PHP generator; PHP UIC share actions stay disabled (`actions:false`) while legacy callables remain on the legacy route.
- Phase 3: Go server-side protocol executors (PHP/Rust union).
- Phase 4: eight external definition formats in Go/Rust.
- Phase 5: packaging/static UI embedding.
- Minor: Rust UIC stream TTL is request-driven (no background reaper); abandoned sessions are closed on the next debug request or drop; Rust share store serializes writers only within one process.
- `getAllApiMenus` (legacy read route) still accepts app tokens and returns every app's menus; intentional legacy read behavior, but deployments should treat it as app-wide data.

## Follow-ups

1. Independent Phase 2 review + one fix wave.
2. Merge the four `feat/uic1-phase0` branches after review.
3. Schedule Phase 2b/3/4 as separate programs; do not claim them as done.
