# UIC-1 Phase 0/1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the UIC-1 contract and ship the first working compatibility layer: one UI build that renders docs, logs in, and debugs HTTP/WS/SSE against PHP, Go and Rust, with Rust relay debug working.

**Architecture:** Add a small UI backend-adapter layer (UIC-1 + legacy PHP). PHP adds UIC-1 aliases and plaintext/Bearer auth while keeping every legacy route. Go and Rust add native UIC-1 endpoints that map their existing models; Rust additionally wraps its unary/stream debug executors into UIC-1 sessions. Contract fixtures are the shared acceptance test.

**Tech Stack:** Vue 3 + TypeScript + Vitest; PHP 8; Go 1.24; Rust 2024 + axum/actix.

**Spec:** `docs/superpowers/specs/2026-10-25-multi-backend-parity-design.md`

## Global Constraints

- UIC-1 namespace `{API_PREFIX}/ui/v1`; envelope `{code,message,data}`; success `code:0`.
- Legacy PHP routes and behavior stay unchanged.
- UIC-1 auth: plaintext password over HTTPS, `Authorization: Bearer`; legacy PHP keeps MD5 + body token.
- Token cache keys include host: `${host}|${scope}`.
- `/ui/v1/config` returns the full `ConfigResult` shape; `generator[].table` is singular.
- Go default build gains no heavy dependencies; protocol executors are Phase 3.
- Rust native `/apidoc/debug` stays global-password-only; UIC-1 debug supports global/app scopes in Phase 1, share scope in Phase 2.
- No native Go/Rust adapters in the UI; UIC-1 only, plus legacy PHP.
- Contract fixtures: `apidoc-ui/contract/` is the only source of truth; copies in backend repos are generated.
- Work in per-repo git worktrees. Do not touch the idle peer sessions for `apidoc-php`, `apidoc-go`, `apidoc-rust`. The pre-existing `.vscode/settings.json` deletion is not part of this work.

## Review Focus

1. Two hosts with the same appKey must not share tokens.
2. A legacy PHP backend without UIC-1 must load through the legacy adapter.
3. A backend advertising a capability must return the documented shape, or the UI fails closed.
4. Rust relay must reject out-of-scope app tokens and never bypass SSRF/limits.
5. First paint must not fetch the whole document; `exportAllData` is export-only.
6. Rust `cache/clear|warm` must return `mode:"build"` and the UI must explain it.

## File Structure

### apidoc-ui

- `contract/uic-1/schema.json` — UIC-1 schema (documentation + validator input).
- `contract/uic-1/fixtures/*.json` — canonical request/response fixtures.
- `contract/check.mjs` — dependency-free fixture shape checks.
- `scripts/sync-contract.sh` — copy fixtures to backend repos.
- `src/backend/types.ts` — `BackendAdapter`, `Capabilities`, `DebugAdapter`.
- `src/backend/detect.ts` — override + probes.
- `src/backend/http.ts` — envelope/auth client.
- `src/backend/uic.ts` — UIC-1 adapter.
- `src/backend/phpLegacy.ts` — legacy PHP adapter.
- `src/backend/gating.ts` — capability checks.
- `src/backend/index.ts` — singleton accessor.
- `src/utils/helper/authKey.ts` — host-scoped auth key.
- `src/backend/__tests__/*.test.ts` — adapter/detection/token tests.
- Modified: `src/layout/index.vue`, `src/store/modules/app/index.ts`, `src/store/modules/Apidoc/index.ts`, `src/utils/http/axios/index.ts`, `src/components/VerifyAuth/VerifyAuthModal.vue`, `src/pages/apiDetail/index.vue`, `src/pages/apiDetail/DebugTab/ProtocolDebug.vue`, `src/pages/apiDetail/DebugTab/drivers/relay.ts`, `src/layout/header/ToolsMenu.vue`, `src/components/ApiShare/ApiShare.vue`, `src/components/Generator/GeneratorModal.vue`.

### apidoc-php

- `src/Controller.php` — add UIC-1 methods and route aliases.
- `src/providers/BaseService.php` — add UIC-1 route rules.
- `src/utils/Request.php` — header helper.
- `src/Auth.php` — plaintext verify + scoped token helpers.
- `tests/_bootstrap.php` — shared test bootstrap.
- `tests/ui_contract.php` — UIC-1 contract test.
- `tests/fixtures/ui_server.php` — E2E router for PHP built-in server.
- Modified docs: `README.md` / `docs/ATTRIBUTES.md` only if the contract is user-visible.

### apidoc-go

- `doc.go`, `model/model.go`, `store/store.go`, `parse/parse.go` — protocol opts/events + action fields.
- `server/uiapi/uiapi.go` — UIC-1 handlers.
- `server/uiapi/auth.go` — Bearer/scoped auth.
- `server/uiapi/*_test.go` — contract tests.
- `server/server.go` — mount `/ui/v1` routes.
- Modified: `README.md` protocol annotations.

### apidoc-rust

- `crates/apidoc/src/uiapi.rs` — UIC-1 route/core mapping.
- `crates/apidoc/src/uiapi/auth.rs` — scoped tokens.
- `crates/apidoc/src/uiapi/debug.rs` — unary/session bridge.
- `crates/apidoc/src/route_core.rs` — `pub(crate)` accessors + session state.
- `crates/apidoc/src/axum.rs`, `actix.rs` — mount `/ui/v1` routes.
- `crates/apidoc/src/lib.rs` — module wiring.
- `crates/apidoc/tests/uic1_contract.rs` — contract test.
- Modified: `README.md` debug/auth docs.

---

## Workstream A: Contract

### Task 1: Create UIC-1 schema and fixtures

**Files:**
- Create: `contract/uic-1/schema.json`
- Create: `contract/uic-1/fixtures/capabilities.json`
- Create: `contract/uic-1/fixtures/config.json`
- Create: `contract/uic-1/fixtures/menus.json`
- Create: `contract/uic-1/fixtures/detail.json`
- Create: `contract/uic-1/fixtures/docs.json`
- Create: `contract/uic-1/fixtures/debug.json`
- Create: `contract/uic-1/fixtures/share.json`
- Create: `contract/uic-1/fixtures/generator.json`
- Create: `contract/uic-1/fixtures/export.json`
- Create: `contract/check.mjs`
- Create: `scripts/sync-contract.sh`
- Test: `node contract/check.mjs`

**Interfaces:**
- Fixtures are arrays of `{ "name": string, "request": object, "response": object }`.
- Every response is `{ "code": 0, "message": "ok", "data": ... }`.
- `capabilities.data.features` uses the shape in spec §5.2.
- `detail.data` includes `menuKey`, `title`, `method`, `url`, `header`, `query`, `routeParam`, `param`, `responseSuccess`, `responseError`, `responseStatus`, `protocol`, `channel`, `debug`, `definitions`, `validation`.

- [ ] **Step 1: Write the schema file**

Define `$defs` for `Envelope`, `Capabilities`, `Config`, `MenuItem`, `Detail`, `DebugResult`, `ShareRecord`, `Error`. Required fields only; allow additional properties.

- [ ] **Step 2: Write one fixture per endpoint**

Use a single HTTP endpoint with `POST /items/{id}` for menus/detail, a WS endpoint for browser debug, and a relay endpoint for debug sessions. Put literal expected values, not placeholders.

- [ ] **Step 3: Write `contract/check.mjs`**

```js
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const names = ['capabilities','config','menus','detail','docs','debug','share','generator','export']
for (const name of names) {
  const fixtures = JSON.parse(readFileSync(new URL(`./uic-1/fixtures/${name}.json`, import.meta.url)))
  for (const f of fixtures) {
    assert.equal(f.response.code, 0, `${name}:${f.name} code`)
    assert.ok(f.response.data, `${name}:${f.name} data`)
  }
}
console.log(`checked ${names.length} fixture files`)
```

- [ ] **Step 4: Run the check**

Run: `node contract/check.mjs`
Expected: `checked 9 fixture files`

- [ ] **Step 5: Write the sync script**

```bash
#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/contract"
for dst in "${APIDOC_PHP_DIR:-$root/../apidoc-php}" "${APIDOC_GO_DIR:-/home/wwwroot/bag/apidoc-go}" "${APIDOC_RUST_DIR:-/home/wwwroot/bag/apidoc-rust}"; do
  rm -rf "$dst/contract"
  cp -R "$src" "$dst/contract"
done
```

- [ ] **Step 6: Commit**

```bash
git add contract scripts/sync-contract.sh
git commit -m "test(contract): add UIC-1 schemas and fixtures"
```

### Task 2: Add UI contract-test harness

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (devDependency `vitest`, script `test`)
- Create: `src/backend/__tests__/fixtures.test.ts`

**Interfaces:**
- `loadFixture<T>(name: string): Promise<T[]>` reads `contract/uic-1/fixtures/${name}.json`.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest@^2`
Expected: `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Add the test script and config**

`package.json`: `"test": "vitest run"`.
`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node' } })
```

- [ ] **Step 3: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
const load = async (name: string) =>
  JSON.parse(await readFile(new URL(`../../../contract/uic-1/fixtures/${name}.json`, import.meta.url), 'utf8'))
describe('contract fixtures', () => {
  it('loads menus', async () => {
    const rows = await load('menus')
    expect(rows[0].response.data.app).toBeTruthy()
  })
})
```

- [ ] **Step 4: Run the test**

Run: `npm test -- src/backend/__tests__/fixtures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/backend/__tests__
git commit -m "test(ui): add contract fixture harness"
```

### Task 3: Add PHP contract-test harness

**Files:**
- Create: `/home/wwwroot/erikwang2013/apidoc-php/tests/ui_contract.php`
- Test: `php tests/ui_contract.php`

**Interfaces:**
- The test bootstraps like `tests/smoke.php` (`APIDOC_ROOT_PATH`, `APIDOC_STORAGE_PATH`, autoloader, `check()`).
- It reads `contract/uic-1/fixtures/*.json` from the repo root.

- [ ] **Step 1: Write the failing test**

```php
<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
$fixtures = json_decode(file_get_contents(__DIR__ . '/../contract/uic-1/fixtures/menus.json'), true);
check('menus fixture loads', is_array($fixtures) && isset($fixtures[0]['response']['code']));
check('menus fixture envelope', $fixtures[0]['response']['code'] === 0);
```

Create `tests/_bootstrap.php` with the shared constants/autoloader/`check()` copied from `tests/smoke.php`, and update `tests/smoke.php`/`tests/protocol.php` only if they are not yet using it (do not refactor them in this task).

- [ ] **Step 2: Run it**

Run: `php tests/ui_contract.php`
Expected: `PASS menus fixture loads` / `PASS menus fixture envelope`.

- [ ] **Step 3: Commit**

```bash
git add tests/_bootstrap.php tests/ui_contract.php
git commit -m "test(php): add UIC-1 contract harness"
```

### Task 4: Add Go and Rust contract-test harnesses

**Files:**
- Create: `/home/wwwroot/bag/apidoc-go/server/uiapi/contract_test.go`
- Create: `/home/wwwroot/bag/apidoc-rust/crates/apidoc/tests/uic1_contract.rs`
- Test: `go test ./server/uiapi`, `cargo test -p apidoc-rust --test uic1_contract`

**Interfaces:**
- Go reads `../../contract/uic-1/fixtures/*.json` from `server/uiapi`; Rust tests run with cwd `crates/apidoc`, so Rust reads `../../contract/uic-1/fixtures/*.json`.
- Go test builds a `httptest.NewServer(server.Handler(...))`; Rust test uses the existing axum test helpers.

- [ ] **Step 1: Write the Go test skeleton**

```go
package uiapi
import ("encoding/json";"os";"testing")
func TestFixturesLoad(t *testing.T) {
  b, err := os.ReadFile("../../contract/uic-1/fixtures/menus.json")
  if err != nil { t.Fatal(err) }
  var rows []struct{ Name string `json:"name"` }
  if err := json.Unmarshal(b, &rows); err != nil { t.Fatal(err) }
  if len(rows) == 0 { t.Fatal("no fixtures") }
}
```

- [ ] **Step 2: Write the Rust test skeleton**

```rust
#[test]
fn fixtures_load() {
    let raw = std::fs::read_to_string("../../contract/uic-1/fixtures/menus.json").unwrap();
    let rows: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert!(rows.as_array().is_some_and(|a| !a.is_empty()));
}
```

- [ ] **Step 3: Run both**

Run: `cd /home/wwwroot/bag/apidoc-go && go test ./server/uiapi`
Run: `cd /home/wwwroot/bag/apidoc-rust && cargo test -p apidoc-rust --test uic1_contract`
Expected: PASS.

- [ ] **Step 4: Commit in each repo**

```bash
git add server/uiapi/contract_test.go
git commit -m "test(go): add UIC-1 contract harness"
```
```bash
git add crates/apidoc/tests/uic1_contract.rs
git commit -m "test(rust): add UIC-1 contract harness"
```

### Task 5: Fix UI baseline mismatches

**Files:**
- Modify: `types/index.d.ts:1`
- Modify: `src/store/modules/app/types.ts:64-75`
- Modify: `src/components/ApiShare/ApiShare.vue:24`
- Test: `npm run build`

**Interfaces:**
- `FeConfig` import points to `'/@/store/modules/app/types'`.
- `HOSTS` is `HostItem[]`; `public/config.js` and README use objects.
- Share list uses `create_at` with `create_time` fallback.

- [ ] **Step 1: Fix the type import**

Change `types/index.d.ts` to `import { FeConfig } from '/@/store/modules/app/types'`.

- [ ] **Step 2: Align HOSTS**

Keep `HostItem[]` in the type; update README example and any config docs to `HOSTS: [{title:"prod",host:"https://..."}]`. Do not change runtime behavior.

- [ ] **Step 3: Fix share timestamp rendering**

Render `item.create_at || item.create_time || ''`.

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add types/index.d.ts src/store/modules/app/types.ts README.md src/components/ApiShare/ApiShare.vue
git commit -m "fix(ui): align config types and share timestamps"
```

---

## Workstream B: UI Adapter

### Task 6: Backend types and detection

**Files:**
- Create: `src/backend/types.ts`
- Create: `src/backend/detect.ts`
- Test: `src/backend/__tests__/detect.test.ts`

**Interfaces:**
- `BackendKind = 'uic' | 'php-legacy'`
- `BackendAdapter` methods from spec §6.1, plus `authHashesPassword: boolean` (`true` only for legacy PHP).
- `DetectedBackend { kind: BackendKind; capabilities: Capabilities }`
- `detectBackend({ host, prefix, override, probe }): Promise<DetectedBackend>`
- `probe(path): Promise<{ status: number; json?: unknown }>`
- Detection order: override → `GET /ui/v1/capabilities` → legacy `GET /config` → throw `BackendDetectionError`.
- Legacy PHP detection accepts `200` or an auth failure (`401`/`402` with `code` in `4001,4002,4005`), because `/config` is guarded when auth is enabled.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { detectBackend } from '../detect'
it('prefers UIC-1 when capabilities respond', async () => {
  const probe = vi.fn(async (path: string) =>
    path.endsWith('/ui/v1/capabilities')
      ? { status: 200, json: { code: 0, data: { contract: '1.0', backend: 'go' } } }
      : { status: 404 })
  const detected = await detectBackend({ host: 'https://a', prefix: '/apidoc', override: 'auto', probe })
  expect(detected.kind).toBe('uic')
})
it('falls back to legacy PHP', async () => {
  const probe = vi.fn(async (path: string) =>
    path.endsWith('/config') ? { status: 200, json: { code: 0, data: {} } } : { status: 404 })
  const detected = await detectBackend({ host: 'https://a', prefix: '/apidoc', override: 'auto', probe })
  expect(detected.kind).toBe('php-legacy')
})
it('recognizes guarded legacy PHP', async () => {
  const probe = vi.fn(async (path: string) =>
    path.endsWith('/config') ? { status: 401, json: { code: 4001, message: 'token error' } } : { status: 404 })
  const detected = await detectBackend({ host: 'https://a', prefix: '/apidoc', override: 'auto', probe })
  expect(detected.kind).toBe('php-legacy')
})
```

- [ ] **Step 2: Run it**

Run: `npm test -- src/backend/__tests__/detect.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement types and detection**

Keep detection pure: it takes a `probe` function, not axios. Cache results per `host|prefix|override` in a `Map`.

- [ ] **Step 4: Run it**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/types.ts src/backend/detect.ts src/backend/__tests__/detect.test.ts
git commit -m "feat(ui): add backend detection"
```

### Task 7: UIC-1 adapter

**Files:**
- Create: `src/backend/http.ts`
- Create: `src/backend/uic.ts`
- Test: `src/backend/__tests__/uic.test.ts`

**Interfaces:**
- `BackendHttp { get(path, params?): Promise<any>; post(path, data?): Promise<any> }`
- `createBackendHttp({ baseURL, prefix, getToken }): BackendHttp` uses a dedicated axios instance with `Authorization: Bearer ${getToken()}` when a token exists.
- `createUicAdapter(http: BackendHttp, capabilities: Capabilities): BackendAdapter`
- `unwrapEnvelope<T>(res: any): T` throws `BackendResponseError` when `code !== 0`; the error exposes `response = {status, data:{code,message}}` so the existing auth/error flow can classify it.
- `uicAdapter.debug` maps to `/debugSend|Start|Poll|Stop`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it, vi } from 'vitest'
import { createUicAdapter } from '../uic'
import caps from '../../../contract/uic-1/fixtures/capabilities.json'
import menus from '../../../contract/uic-1/fixtures/menus.json'
it('normalizes menus and sends Authorization', async () => {
  const post = vi.fn(async () => ({ code: 0, message: 'ok', data: menus[0].response.data }))
  const adapter = createUicAdapter({ get: vi.fn(), post } as any, caps[0].response.data)
  const res = await adapter.menus({ appKey: 'default' })
  expect(res.data.length).toBeGreaterThan(0)
  expect(post).toHaveBeenCalledWith('/ui/v1/menus', { appKey: 'default' })
})
```

- [ ] **Step 2: Run it**

Expected: FAIL.

- [ ] **Step 3: Implement**

`http.ts` uses `axios.create({ baseURL, headers: token ? {Authorization:`Bearer ${token}`} : {} })`; no legacy interceptor. `unwrapEnvelope` handles `{code,message,data}` and raw payloads only when `capabilities.contract` is missing? No: UIC-1 always envelopes.

- [ ] **Step 4: Run it**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/http.ts src/backend/uic.ts src/backend/__tests__/uic.test.ts
git commit -m "feat(ui): add UIC-1 adapter"
```

### Task 8: Legacy PHP adapter

**Files:**
- Create: `src/backend/phpLegacy.ts`
- Test: `src/backend/__tests__/phpLegacy.test.ts`

**Interfaces:**
- `createPhpLegacyAdapter(http: BackendHttp): BackendAdapter`
- `kind = 'php-legacy'`; capabilities are all true for existing PHP features, `debug.modes` = the five existing modes.
- `verifyAuth` sends the already-MD5 password (the caller decides hashing via `adapter.authHashesPassword`).

- [ ] **Step 1: Write the failing test**

```ts
it('uses legacy endpoint names', async () => {
  const post = vi.fn(async () => ({ code: 0, data: [] }))
  const adapter = createPhpLegacyAdapter({ get: vi.fn(), post } as any)
  await adapter.menus({ appKey: 'a' })
  expect(post).toHaveBeenCalledWith('/apiMenus', { appKey: 'a' })
})
```

- [ ] **Step 2: Run it**

Expected: FAIL.

- [ ] **Step 3: Implement by delegating to the existing `apidocApi`/`globalApi` methods**

Do not duplicate URL strings; import the existing classes. Add `authHashesPassword = true`.

- [ ] **Step 4: Run it**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/phpLegacy.ts src/backend/__tests__/phpLegacy.test.ts
git commit -m "feat(ui): add legacy PHP adapter"
```

### Task 9: Host-scoped tokens and auth modal

**Files:**
- Create: `src/utils/helper/authKey.ts`
- Modify: `src/store/modules/app/index.ts:140-150`
- Modify: `src/utils/http/axios/index.ts:48-71`
- Modify: `src/components/VerifyAuth/VerifyAuthModal.vue:67-90`
- Test: `src/backend/__tests__/authKey.test.ts`

**Interfaces:**
- `authKey(host: string, scope: string): string` → `${normalizeHost(host)}|${scope}`.
- `setAppAuth(scope, token, host?)`, `getAppAuth(scope, host?)`.
- `initAppAuth` migrates legacy keys to the current host once.
- Auth modal calls `backend.verifyAuth`; hashes with MD5 only when `backend.kind === 'php-legacy'`.

- [ ] **Step 1: Write the failing test**

```ts
import { authKey } from '../../utils/helper/authKey'
it('separates hosts', () => {
  expect(authKey('https://a', 'app')).not.toBe(authKey('https://b', 'app'))
})
```

- [ ] **Step 2: Run it**

Expected: FAIL.

- [ ] **Step 3: Implement**

`normalizeHost` strips trailing slashes; `same-origin` for empty. In the store, keep the old key shape out of new writes. In the axios interceptor, use the current host from `baseURL`/`window.location.origin`.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/backend/__tests__/authKey.test.ts && npm run build`
Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/utils/helper/authKey.ts src/store/modules/app/index.ts src/utils/http/axios/index.ts src/components/VerifyAuth/VerifyAuthModal.vue src/backend/__tests__/authKey.test.ts
git commit -m "fix(ui): scope auth tokens by host"
```

### Task 10: Debug adapter and ProtocolDebug integration

**Files:**
- Modify: `src/backend/types.ts` (add `DebugAdapter`)
- Modify: `src/pages/apiDetail/DebugTab/drivers/relay.ts:7-72`
- Modify: `src/pages/apiDetail/DebugTab/ProtocolDebug.vue:238-421`
- Test: `src/backend/__tests__/debug.test.ts`

**Interfaces:**
- `DebugAdapter.send(params)` → `ApiDebugResult`.
- `DebugAdapter.start(params)` → `{sessionId?: string; ok?: boolean; error?: string}`.
- `DebugAdapter.poll(sessionId, scope)` → `{ok?: boolean; messages?: RelayStreamMessage[]; error?: string}`.
- `DebugAdapter.stop(sessionId, scope)` → `{ok?: boolean}`.
- `sendRelay(adapter, detail, input)` uses `detail.menuKey` un-decoded for UIC-1; legacy adapter decodes it.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it, vi } from 'vitest'
import { sendRelay } from '../../pages/apiDetail/DebugTab/drivers/relay'
it('routes relay calls through the adapter', async () => {
  const send = vi.fn(async () => ({ ok: true, body: 'x', encoding: 'text' }))
  const adapter = { debug: { send } } as any
  const res = await sendRelay(adapter, { menuKey: 'abc' } as any, {} as any)
  expect(res.ok).toBe(true)
  expect(send).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run it**

Expected: FAIL.

- [ ] **Step 3: Implement**

Keep the polling loop and session renewal; replace direct `debugApi` imports with `adapter.debug`. Do not change the 1100 ms interval or the expiry regex without a test.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/backend/__tests__/debug.test.ts && npm run build`
Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/backend/types.ts src/pages/apiDetail/DebugTab/drivers/relay.ts src/pages/apiDetail/DebugTab/ProtocolDebug.vue src/backend/__tests__/debug.test.ts
git commit -m "feat(ui): route protocol debug through backend adapter"
```

### Task 11: Bootstrap and capability gating

**Files:**
- Create: `src/backend/index.ts`
- Create: `src/backend/gating.ts`
- Modify: `src/layout/index.vue:67-109`
- Modify: `src/store/modules/app/index.ts:19-163`
- Modify: `src/store/modules/Apidoc/index.ts:45-94`
- Modify: `src/layout/header/ToolsMenu.vue`
- Modify: `src/components/ApiShare/ApiShare.vue`
- Modify: `src/components/Generator/GeneratorModal.vue`
- Modify: `src/pages/apiDetail/index.vue:236-243`
- Test: `npm run build` + `src/backend/__tests__/gating.test.ts`

**Interfaces:**
- `initBackend({host,prefix,override}): Promise<BackendAdapter>` detects, constructs `UicAdapter` or `PhpLegacyAdapter`, and stores the singleton.
- `getBackend(): BackendAdapter`.
- `featureEnabled(capabilities: Capabilities, path: string): boolean` reads a dot path (`share.records`, `cache.manage`, `generator.forms`, `debug.modes`).
- `appStore.capabilities` set from `config.capabilities`.
- Gating: ToolsMenu shows share/cache/generator only when the matching capability is true; detail hides debug tab when `debug.modes` lacks the mode or `debuggable === false`.

- [ ] **Step 1: Write the failing gating test**

```ts
import { expect, it } from 'vitest'
import { featureEnabled } from '../gating'
it('hides share records when unsupported', () => {
  expect(featureEnabled({ features: { share: { records: false } } } as any, 'share.records')).toBe(false)
})
it('defaults missing paths to false', () => {
  expect(featureEnabled({ features: {} } as any, 'cache.manage')).toBe(false)
})
```

- [ ] **Step 2: Run it**

Expected: FAIL.

- [ ] **Step 3: Implement**

Replace `fetchSeverConfig`/`fetchApiMenus`/`fetchDocsMenus` internals with adapter calls. Keep legacy fallback when detection returns `php-legacy`. Do not remove the old API classes; they are used by the legacy adapter.

- [ ] **Step 4: Run build and tests**

Run: `npm test && npm run build`
Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/backend src/layout src/store src/components/ApiShare src/components/Generator src/pages/apiDetail/index.vue
git commit -m "feat(ui): bootstrap through backend adapter and gate capabilities"
```

---

## Workstream C: PHP

### Task 12: UIC-1 routes, capabilities and config

**Files:**
- Modify: `src/providers/BaseService.php:13-36`
- Modify: `src/Controller.php` (new `uiCapabilities`, `uiConfig`, `uiMenus`, `uiDetail`, `uiDocMenus`, `uiDocDetail`, `uiVerifyAuth`, `uiDebugSend`, `uiDebugStart`, `uiDebugPoll`, `uiDebugStop`)
- Create: `src/ui/UiCapabilities.php`
- Test: `tests/ui_contract.php`

**Interfaces:**
- Routes: `ui/v1/capabilities`, `ui/v1/config`, `ui/v1/menus`, `ui/v1/detail`, `ui/v1/docMenus`, `ui/v1/docDetail`, `ui/v1/verifyAuth`, `ui/v1/debugSend|Start|Poll|Stop`.
- `UiCapabilities::fromConfig(array $config): array` returns spec §5.2; namespace `erikwang2013\apidoc\ui`, file `src/ui/UiCapabilities.php`.
- `Controller::uiConfig()` returns `Helper::showJson(0,'',$config)`; `uiMenus()` delegates to `getApiMenus()`; etc.

- [ ] **Step 1: Write the failing test**

```php
$caps = \erikwang2013\apidoc\ui\UiCapabilities::fromConfig([
    'auth' => ['enable' => true, 'password' => 'pw'],
    'cache' => ['enable' => true],
]);
$cfg = json_decode(file_get_contents(__DIR__ . '/../contract/uic-1/fixtures/config.json'), true)[0]['response']['data'];
check('capabilities has contract 1.0', ($caps['contract'] ?? '') === '1.0');
check('capabilities backend is php', ($caps['backend'] ?? '') === 'php');
check('config has apps array', is_array($cfg['apps'] ?? null));
```

- [ ] **Step 2: Run it**

Expected: FAIL (class/route missing).

- [ ] **Step 3: Implement**

Add the route rules and controller methods. `uiCapabilities` reads `ConfigProvider::get()` and returns the feature map. `uiConfig` calls the legacy `getConfig()` (same envelope). Keep legacy rules unchanged.

- [ ] **Step 4: Run tests**

Run: `php tests/ui_contract.php && php tests/smoke.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/providers/BaseService.php src/Controller.php src/ui/UiCapabilities.php tests/ui_contract.php
git commit -m "feat(php): add UIC-1 read routes and capabilities"
```

### Task 13: PHP UIC-1 plaintext/Bearer auth

**Files:**
- Modify: `src/Auth.php` (add `verifyPlain`, `checkTokenPlain`)
- Modify: `src/utils/Request.php` (add `header(string $name): string`)
- Modify: `src/Controller.php` (`uiVerifyAuth`, and `initUi()` that maps Bearer to `requestParams['token']`)
- Test: `tests/ui_contract.php`

**Interfaces:**
- `Auth::verifyPlain(string $plain, string $appKey): string` returns a token, throws `ErrorException("password error")` on mismatch.
- `Request::header('Authorization')` returns `Bearer ...` or `''`; handles `HTTP_AUTHORIZATION`, `REDIRECT_HTTP_AUTHORIZATION`, `getallheaders()`.
- `Controller::init()` maps `Authorization: Bearer <token>` into `requestParams['token']` when no body/query token exists. This applies to legacy and UIC-1 routes (harmless for legacy) so `uiConfig` can delegate to `getConfig()` without losing the token.

- [ ] **Step 1: Write the failing test**

```php
$auth = new Auth(['auth'=>['enable'=>true,'password'=>'pw','secret_key'=>'s','expire'=>3600]]);
$token = $auth->verifyPlain('pw', '');
check('plain token verifies', $auth->checkToken($token, '') === true);
check('wrong plain password throws', (function() use ($auth) { try { $auth->verifyPlain('bad',''); return false; } catch (\Throwable $e) { return true; } })());
```

- [ ] **Step 2: Run it**

Expected: FAIL.

- [ ] **Step 3: Implement**

Reuse `createToken($plain)` and `checkToken`. Do not change legacy `verifyAuth` (MD5). `uiVerifyAuth` reads `password` plaintext; if `shareKey` is present, use the existing share password path with plaintext comparison.

- [ ] **Step 4: Run tests**

Run: `php tests/ui_contract.php && php tests/smoke.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/Auth.php src/utils/Request.php src/Controller.php tests/ui_contract.php
git commit -m "feat(php): add UIC-1 plaintext and bearer auth"
```

### Task 14: PHP UIC-1 debug wrappers

**Files:**
- Modify: `src/Controller.php` (uiDebug* methods call `initUi()` + existing debug methods)
- Test: `tests/ui_contract.php` + `tests/debug.php`

**Interfaces:**
- `uiDebugSend/Start/Poll/Stop` return the same envelopes as legacy.
- Bearer/app/share scope uses the existing `checkAuth` logic after `init()` injects the token.

- [ ] **Step 1: Write the failing test**

```php
check('debug route declared', in_array('ui/v1/debugSend', array_column(\erikwang2013\apidoc\providers\BaseService::$routes, 'rule'), true));
```

- [ ] **Step 2: Run it**

Expected: FAIL.

- [ ] **Step 3: Implement**

Thin wrappers; no behavior change. Keep the legacy debug methods untouched.

- [ ] **Step 4: Run tests**

Run: `php tests/ui_contract.php && php tests/debug.php`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/Controller.php tests/ui_contract.php
git commit -m "feat(php): expose UIC-1 debug aliases"
```

---

## Workstream D: Go

### Task 15: Add protocol opts/events to the Go model and parser

**Files:**
- Modify: `model/model.go` (`Doc`, `Action`, new `DocEvent`)
- Modify: `doc.go` (export `Event`, if needed)
- Modify: `store/store.go:55-104` (copy new fields)
- Modify: `parse/parse.go:136-250` (parse `@protocol-opt`, `@event`)
- Test: `parse/parse_test.go` (existing) + `model/model_test.go` if present

**Interfaces:**
- `type DocEvent struct { Direction, Name, Type, Desc, Mock string }` with JSON tags `direction,name,type,desc,mock`.
- `Doc.ProtocolOpts map[string]string`, `Doc.Events []DocEvent`.
- `Action.ProtocolOpts map[string]string`, `Action.Events []DocEvent`.
- Annotation syntax: `@protocol-opt target=mqtt://broker:1883/sensors`; `@event direction=out name=join type=json desc="加入" mock={}`.

- [ ] **Step 1: Write the failing test**

```go
func TestParseProtocolOptsAndEvents(t *testing.T) {
  doc := parseDoc(t, `@apidoc
@protocol mqtt
@method SUBSCRIBE
@url mqtt://broker:1883/sensors/+
@protocol-opt topic=sensors/+
@event direction=in name=temperature type=json desc="温度" mock={"v":1}
`)
  if doc.ProtocolOpts["topic"] != "sensors/+" { t.Fatal(doc.ProtocolOpts) }
  if len(doc.Events) != 1 || doc.Events[0].Direction != "in" { t.Fatal(doc.Events) }
}
```

- [ ] **Step 2: Run it**

Run: `go test ./parse -run TestParseProtocolOptsAndEvents`
Expected: FAIL (unknown annotation).

- [ ] **Step 3: Implement**

Parse key/value pairs; validate `direction` is `in|out`; keep existing annotations untouched. Add fields to `Action` in `store.Register`. Ensure existing `/api/*` JSON tests still pass (new fields are additive; use `omitempty` where possible).

- [ ] **Step 4: Run tests**

Run: `go test ./...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add doc.go model/model.go store/store.go parse/parse.go parse/parse_test.go
git commit -m "feat(go): add protocol opts and events annotations"
```

### Task 16: Go UIC-1 capabilities/config/menus/detail/docs

**Files:**
- Create: `server/uiapi/uiapi.go`
- Create: `server/uiapi/testutil_test.go` (`newTestUIHandler`, `do`, `doWithHeader`)
- Modify: `apidoc.go` (`AppConfig.PublicHost string`; optional `Config.PublicHost string` fallback)
- Modify: `server/server.go:43-56` (mount `/ui/v1/*`)
- Test: `server/uiapi/uiapi_test.go`

**Interfaces:**
- `uiapi.Handler(o server.Opts) http.Handler` or `uiapi.Register(mux *http.ServeMux, o server.Opts)`.
- `GET /ui/v1/capabilities`, `GET /ui/v1/config`, `POST /ui/v1/menus`, `POST /ui/v1/detail`, `GET/POST /ui/v1/docMenus`, `POST /ui/v1/docDetail`.
- `appKey` for Go is `"<app>|<version>"` for leaf apps; `config.apps` flattens versions to leaves. If app/version contain `|`, replace it with `%7C` before joining.
- `AppConfig.PublicHost` populates `config.apps[].host`; `Config.PublicHost` is the fallback for apps without one; both empty means same-origin.
- Test helpers: `newTestUIHandler(t) http.Handler` builds a store with `default/v1/default/GET /items`; `do(h, method, path, body) *httptest.ResponseRecorder`; `doWithHeader(h, method, path, body, key, value)`.
- `menus` groups Actions by `Controller` and returns `ApiMenuItem` nodes.
- `detail` maps `Param.In` and `Response` as described in spec §5.3.

- [ ] **Step 1: Write the failing test**

```go
func TestUICapabilitiesAndMenus(t *testing.T) {
  h := newTestUIHandler(t) // store with one HTTP action and one WS action
  rec := do(h, "GET", "/ui/v1/capabilities", "")
  if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"contract":"1.0"`) { t.Fatal(rec.Body.String()) }
  rec = do(h, "POST", "/ui/v1/menus", `{"appKey":"default|v1"}`)
  if !strings.Contains(rec.Body.String(), `"menuKey"`) { t.Fatal(rec.Body.String()) }
  rec = do(h, "POST", "/ui/v1/detail", `{"appKey":"default|v1","path":"ws-action-id"}`)
  if !strings.Contains(rec.Body.String(), `"browser-websocket"`) { t.Fatal(rec.Body.String()) }
}
```

- [ ] **Step 2: Run it**

Expected: FAIL (404).

- [ ] **Step 3: Implement**

Build the app tree from `Store.Project()`. Use `Action.ID` for `menuKey`. Map protocol/channel/debug from `Action.Protocol`, `ProtocolOpts`, `Events`. Detail `md` = raw `Action.Markdown`; `markdown_html` stays for legacy. `definitions` = `[]`, `validation` = `{ok:true,errors:[],warnings:[]}` in Phase 1.

- [ ] **Step 4: Run tests**

Run: `go test ./server/...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/uiapi server/server.go
git commit -m "feat(go): add UIC-1 read endpoints"
```

### Task 17: Go UIC-1 auth

**Files:**
- Create: `server/uiapi/auth.go`
- Modify: `server/uiapi/uiapi.go` (wrap handlers with auth)
- Modify: `auth/auth.go` only if a Bearer helper is missing
- Test: `server/uiapi/auth_test.go`

**Interfaces:**
- `POST /ui/v1/verifyAuth {password,appKey?,shareKey?}` → `{token,expire?}`.
- Bearer middleware accepts `Authorization: Bearer <token>`; app tokens use existing `X-Apidoc-App-Token` as fallback for legacy.
- Global password uses `o.Auth`; app password uses `o.AppPWs`.
- Phase 1 share scope returns 400/501 (share records are Phase 2).

- [ ] **Step 1: Write the failing test**

```go
func TestUIAuthLoginAndBearer(t *testing.T) {
  h := newTestUIHandler(t)
  rec := do(h, "POST", "/ui/v1/verifyAuth", `{"password":"pw"}`)
  var body struct{ Data struct{ Token string } }
  json.Unmarshal(rec.Body.Bytes(), &body)
  if body.Data.Token == "" { t.Fatal(rec.Body.String()) }
  rec = doWithHeader(h, "GET", "/ui/v1/config", "", "Authorization", "Bearer "+body.Data.Token)
  if rec.Code != 200 { t.Fatal(rec.Code) }
}
```

- [ ] **Step 2: Run it**

Expected: FAIL.

- [ ] **Step 3: Implement**

Use `auth.CheckPassword` for plaintext, `auth.Issue` for tokens. A Bearer token's data is the scope (`session` or app key); verify it and match the requested app. Do not change the legacy cookie flow.

- [ ] **Step 4: Run tests**

Run: `go test ./...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/uiapi/auth.go server/uiapi/uiapi.go auth/auth.go
git commit -m "feat(go): add UIC-1 bearer auth"
```

---

## Workstream E: Rust

### Task 18: Rust UIC-1 read endpoints

**Files:**
- Create: `crates/apidoc/src/uiapi.rs`
- Create: `crates/apidoc/tests/uic1_common/mod.rs` (`test_router`, `get_json`, `post_json`, `get_with_bearer`)
- Modify: `crates/apidoc/src/lib.rs` (module wiring; `AppConfig.public_host: Option<String>`)
- Modify: `crates/apidoc/src/route_core.rs` (accessors / `pub(crate)` where needed)
- Modify: `crates/apidoc/src/axum.rs`, `actix.rs` (mount `/ui/v1/*`)
- Test: `crates/apidoc/tests/uic1_contract.rs`

**Interfaces:**
- `pub fn routes(router: Router<Arc<Core>>) -> Router<Arc<Core>>` for axum; actix equivalent.
- `GET /ui/v1/capabilities`, `GET /ui/v1/config`, `POST /ui/v1/menus`, `POST /ui/v1/detail`, `GET/POST /ui/v1/docMenus`, `POST /ui/v1/docDetail`.
- `endpoint_id(ep: &DocEndpoint) -> String` = base64url of `protocol \0 method \0 url \0 title`.
- `appKey` for Rust is the leaf `AppDoc.key`; endpoints filter by `app_key`.
- `AppConfig.public_host` populates `config.apps[].host`; empty means same-origin.
- `detail` maps `DocEndpoint` to UI types as spec §5.3/§5.5.
- Test helpers: `test_router()` builds an axum router with one `GET /items` endpoint; `get_json`/`post_json` return `serde_json::Value`; `get_with_bearer` adds `Authorization`.

- [ ] **Step 1: Write the failing test**

```rust
#[tokio::test]
async fn capabilities_and_menus() {
    let app = test_router();
    let caps = get_json(&app, "/ui/v1/capabilities").await;
    assert_eq!(caps["data"]["contract"], "1.0");
    let menus = post_json(&app, "/ui/v1/menus", json!({"appKey":"default"})).await;
    assert!(menus["data"]["data"].as_array().unwrap().len() > 0);
}
```

- [ ] **Step 2: Run it**

Expected: FAIL (404).

- [ ] **Step 3: Implement**

Build a `UiIndex` at `Core::build`: maps `endpoint_id -> &DocEndpoint`, app leaves, menu grouping. Avoid changing `api.json` bytes. Map protocol label from `protocol.rs`; channel address from `protocol_opts["target"]` or url; debug mode from `protocol`/`Interaction`; definitions from `events`.

- [ ] **Step 4: Run tests**

Run: `cargo test -p apidoc-rust --test uic1_contract`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/apidoc/src/uiapi.rs crates/apidoc/src/lib.rs crates/apidoc/src/route_core.rs crates/apidoc/src/axum.rs crates/apidoc/src/actix.rs crates/apidoc/tests/uic1_contract.rs
git commit -m "feat(rust): add UIC-1 read endpoints"
```

### Task 19: Rust UIC-1 scoped auth

**Files:**
- Create: `crates/apidoc/src/uiapi/auth.rs`
- Modify: `crates/apidoc/src/uiapi.rs` (auth middleware)
- Modify: `crates/apidoc/src/auth.rs` (scoped issue/verify helpers)
- Test: `crates/apidoc/tests/uic1_contract.rs`

**Interfaces:**
- `POST /ui/v1/verifyAuth {password,appKey?,shareKey?}` → `{token}`.
- Scoped token payload includes `{exp, scope}`; signature key derived from the credential for that scope. Scope resolution: `app:<key>` uses that app's password if set, else the global password; `global` uses the global password.
- Bearer middleware resolves `scope`, verifies the token with the matching credential, and rejects mismatched app keys.
- Share scope returns 501 in Phase 1 (records arrive Phase 2).

- [ ] **Step 1: Write the failing test**

```rust
#[tokio::test]
async fn auth_round_trip_and_scope_rejection() {
    let app = test_router_with_auth();
    let res = post_json(&app, "/ui/v1/verifyAuth", json!({"password":"pw"})).await;
    let token = res["data"]["token"].as_str().unwrap();
    assert_eq!(get_with_bearer(&app, "/ui/v1/config", token).await.status(), 200);
    assert_eq!(get_with_bearer(&app, "/ui/v1/config", "bad").await.status(), 401);
}
```

- [ ] **Step 2: Run it**

Expected: FAIL.

- [ ] **Step 3: Implement**

Add `auth::issue_scoped(secret, expire, scope, credential)` and `auth::verify_scoped(...)`. Do not change the native token format. Keep native `/apidoc/api.json` query-token guard unchanged.

- [ ] **Step 4: Run tests**

Run: `cargo test -p apidoc-rust --test uic1_contract`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/apidoc/src/uiapi/auth.rs crates/apidoc/src/uiapi.rs crates/apidoc/src/auth.rs crates/apidoc/tests/uic1_contract.rs
git commit -m "feat(rust): add scoped UIC-1 auth"
```

### Task 20: Rust UIC-1 debug send and sessions

**Files:**
- Create: `crates/apidoc/src/uiapi/debug.rs`
- Modify: `crates/apidoc/src/uiapi.rs` (routes)
- Modify: `crates/apidoc/src/route_core.rs` (session state / accessors)
- Modify: `crates/apidoc/src/debug/session.rs` (expose a session handle for polling)
- Test: `crates/apidoc/tests/uic1_contract.rs`

**Interfaces:**
- `POST /ui/v1/debugSend` → `{ok,status,headers,body:{encoding,data},encoding?,meta?,error?}`.
- `POST /ui/v1/debugStart` → `{ok:true,sessionId}`.
- `POST /ui/v1/debugPoll` → `{ok,messages:[{time?,type?,body?,encoding?}]}`.
- `POST /ui/v1/debugStop` → `{ok:true}`.
- Session map: `Mutex<HashMap<String, UiSession>>`, TTL 60s, 100 messages/poll, 1000 frames/session.
- `debug::session::start(cfg, req, ep, frames_tx) -> Result<SessionHandle, String>` where `SessionHandle` exposes `send(Payload)` and `close()`. `start` is `pub(crate)` and reuses `stream_dispatch`; it does not open a loopback WebSocket.
- Scope check happens before calling `debug::execute` or `stream_dispatch`; SSRF/limits remain in the executors.

- [ ] **Step 1: Write the failing test**

```rust
#[tokio::test]
async fn debug_send_is_guarded() {
    let app = test_router_with_auth_and_debug();
    let res = post_json(&app, "/ui/v1/debugSend", json!({
        "appKey":"default","path":"/x","input":{"target":"http://127.0.0.1:1","payload":""}
    })).await;
    assert_eq!(res["data"]["ok"], false);
    assert!(res["data"]["error"].as_str().is_some());
}
```

- [ ] **Step 2: Run it**

Expected: FAIL (404).

- [ ] **Step 3: Implement**

`debugSend` parses `input` into `DebugRequest` (`kind` from detail protocol, `target` from input, `body` payload with encoding, `opts` from fields). Sessions use `stream_dispatch` with an mpsc receiver; store the `StreamSession` handle for `send` (Phase 1 can support connect/close; client send is optional if the protocol is receive-only). Return `{ok:false,error}` on session expiry.

- [ ] **Step 4: Run tests**

Run: `cargo test -p apidoc-rust --test uic1_contract && cargo check --features debug-all`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/apidoc/src/uiapi/debug.rs crates/apidoc/src/uiapi.rs crates/apidoc/src/route_core.rs crates/apidoc/src/debug/session.rs crates/apidoc/tests/uic1_contract.rs
git commit -m "feat(rust): bridge UIC-1 debug to executors"
```

---

## Workstream F: End-to-End

### Task 21: E2E harness and docs

**Files:**
- Create: `scripts/e2e-uic1.mjs`
- Create: `scripts/e2e-uic1.sh`
- Modify: `README.md`, `public/config.js` (document `BACKEND`)
- Modify: backend READMEs with UIC-1 endpoint tables
- Test: `bash scripts/e2e-uic1.sh`

**Interfaces:**
- `e2e-uic1.sh` starts:
  - PHP: `php -S 127.0.0.1:18081 tests/fixtures/ui_server.php`; that router bootstraps `ConfigProvider`, dispatches `/apidoc/ui/v1/*` to `Controller`, and reuses `tests/fixtures/protocol/AnnotationFixtures.php`.
  - Go: `go run ./example` on `:18082` (adjust the example to `apidoc.Config{Prefix:"/apidoc"}`).
  - Rust: `cargo run --example axum_demo --features axum,debug-http,debug-session` on `:18083`.
- `e2e-uic1.mjs` fetches `/ui/v1/capabilities`, `/ui/v1/config`, `/ui/v1/menus`, `/ui/v1/detail` and asserts `code:0` and required keys on all three.
- Cleanup kills only PIDs started by the script; never `pkill -f apidoc`.

- [ ] **Step 1: Write the failing E2E script**

Start with one backend (PHP) and assert `capabilities.contract === '1.0'`; exit 1 if not.

- [ ] **Step 2: Run it**

Run: `bash scripts/e2e-uic1.sh`
Expected: FAIL until PHP UIC-1 is implemented (then PASS).

- [ ] **Step 3: Add Go and Rust**

Use explicit PIDs and `trap` cleanup. Do not reuse ports used by the idle peer sessions; choose 18081-18083.

- [ ] **Step 4: Run all three**

Run: `bash scripts/e2e-uic1.sh`
Expected: `PHP OK`, `Go OK`, `Rust OK`.

- [ ] **Step 5: Document**

Add `BACKEND: "auto"|"php"|"go"|"rust"` to `public/config.js` and README; add UIC-1 endpoint tables to backend READMEs.

- [ ] **Step 6: Commit**

```bash
git add scripts/e2e-uic1.sh scripts/e2e-uic1.mjs README.md public/config.js
git commit -m "test: add UIC-1 end-to-end harness"
```
Commit backend README changes in each repo separately.

---

## Self-Review Checklist

- [ ] Every Phase 1 requirement in the spec has a task: contract, UI detection/adapter/auth/debug/gating, PHP read/auth/debug, Go model/read/auth, Rust read/auth/debug, E2E/docs.
- [ ] Every task has a failing test first, a passing command, and a commit.
- [ ] Type names match across tasks: `BackendAdapter`, `DebugAdapter`, `Capabilities`, `authKey`, `endpoint_id`.
- [ ] Review Focus items are covered: host tokens (Task 9), legacy detection (Task 6/8), capability lies (Task 7/11), relay scope (Task 20), large docs (design), Rust cache (Phase 2, explicitly out of Phase 1).
- [ ] No backend implements Phase 2/3/4 work in this plan.
