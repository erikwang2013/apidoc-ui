#!/usr/bin/env bash
# Copy the UIC-1 contract fixtures into the backend repos.
# Defaults match the local multi-repo layout; override with APIDOC_{PHP,GO,RUST}_DIR.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/contract"

pick_dir() {
  local env_name="$1"
  shift
  local value="${!env_name:-}"
  if [ -n "$value" ]; then
    printf '%s\n' "$value"
    return
  fi
  local candidate
  for candidate in "$@"; do
    if [ -d "$candidate" ]; then
      printf '%s\n' "$candidate"
      return
    fi
  done
  echo "sync-contract: $env_name is not set and no candidate exists" >&2
  exit 1
}

php_dir="$(pick_dir APIDOC_PHP_DIR "$root/../apidoc-php" "$root/../php")"
go_dir="$(pick_dir APIDOC_GO_DIR "$root/../apidoc-go" "$root/../go" /home/wwwroot/bag/apidoc-go)"
rust_dir="$(pick_dir APIDOC_RUST_DIR "$root/../apidoc-rust" "$root/../rust" /home/wwwroot/bag/apidoc-rust)"

for dst in "$php_dir" "$go_dir" "$rust_dir"; do
  rm -rf "$dst/contract"
  cp -R "$src" "$dst/contract"
  echo "synced $dst/contract"
done
