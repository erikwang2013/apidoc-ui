# UIC-1 Contract Fixtures

This directory is the single source of truth for the Apidoc UI Contract 1.0.

- `uic-1/schema.json` documents the payload shapes.
- `uic-1/fixtures/*.json` holds request/response examples used by all four repos.
- `check.mjs` is a dependency-free shape check: `node contract/check.mjs`.
- `../scripts/sync-contract.sh` in the apidoc-ui repo copies this directory into the PHP, Go and Rust repos. Do not edit the generated backend copies.

Every fixture is an array of `{name, request, response}`. A successful response
uses `{code:0,message:"ok",data:...}`. Fixtures are additive within contract 1.x.

When a fixture changes, run the sync script and commit the generated copies in
the backend repos in the same change set. CI should fail if a backend copy
differs from this directory.
