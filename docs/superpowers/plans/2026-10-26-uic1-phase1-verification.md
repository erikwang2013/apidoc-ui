# UIC-1 Phase 1 Verification Plan

**Goal:** Finish the Phase 1 checks that host I/O blocked: UI production build, Rust route/workspace tests, and the three-backend E2E harness.

**Architecture:** Verification-only, with fixes allowed when a check exposes a real defect. Work stays in the existing `feat/uic1-phase0` worktrees.

**Tech Stack:** Vue 3 + Vite; Rust + axum; Go; PHP 8.

**Spec:** `docs/superpowers/specs/2026-10-25-multi-backend-parity-design.md`

## Global Constraints

- Do not modify main checkouts; work only in `/home/erik/worktrees/apidoc-uic1/{ui,php,go,rust}`.
- Do not touch other Claude sessions' processes or artifacts.
- Commits only for real fixes or new harness files; do not commit generated `types/components.d.ts` or `apidoc/` output.
- UIC-1 envelope is `{code,message,data}`, success `code:0`.
- Phase 1 supports read/auth/docs/browser debug; Go/Rust exports and management features stay disabled.

## Task 1: UI production build

**Files:** UI worktree only. Test: `npm run build`.

- Run `npm run build`; capture the exit code and tail.
- If it fails, fix the build error in the UI worktree, rerun, and commit the fix.
- If it passes, revert any generated `types/components.d.ts` change; leave `apidoc/` (gitignored).
- Report: exit code, build output directory timestamp, any fix commit.

## Task 2: Rust route and workspace tests

**Files:** Rust worktree only. Tests:
`cargo test -p apidoc-rust --test uic1_routes --features axum`
`cargo test --workspace`
`cargo check -p apidoc-rust --features axum,debug-http,debug-session`

- Run the route test. If it fails, fix the code or the test assertion, rerun, and commit.
- Run the workspace suite (or document a pre-existing failure unrelated to UIC-1).
- Run the debug-feature compile check.
- Report: exact commands, pass/fail counts, fix commit.

## Task 3: Three-backend E2E harness

**Files:**
- Create `scripts/e2e-uic1.sh`
- Create `scripts/e2e-uic1.mjs`
- Create PHP `tests/fixtures/ui_server.php` in the PHP worktree.

**Interfaces:**
- PHP server on `127.0.0.1:18081`, Go example on `18082`, Rust axum demo on `18083`.
- The harness probes `/ui/v1/capabilities`, `/ui/v1/config`, `/ui/v1/verifyAuth`, `/ui/v1/menus`, `/ui/v1/detail` per backend.
- Cleanup kills only PIDs started by the script; never `pkill -f apidoc`.

- Write the harness and demo router.
- Run it against PHP, Go and Rust; fix failures in the owning repo and commit.
- Report: per-backend pass/fail, ports, cleanup evidence.

## Task 4: Verification review

**Files:** read-only.

- Review the Phase 1 diff and the verification results; report any load-bearing gap.
- No code changes unless a gap is confirmed.
