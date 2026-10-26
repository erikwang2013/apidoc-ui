#!/usr/bin/env bash
# Verify package-ui.sh determinism: package twice from the existing apidoc/
# build, then recompute the manifest sha256 with the command documented in
# the upgrade guide. Requires an existing build; run package:ui first.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
package_dir="$root/dist/uic1-ui"

if [[ ! -f "$root/apidoc/index.html" ]]; then
  echo "check-package-ui: apidoc/index.html is missing; run npm run package:ui first" >&2
  exit 1
fi

manifest_hash() {
  node -e 'console.log(require(process.argv[1]).sha256)' "$package_dir/manifest.json"
}

run_package() {
  local log
  log="$(mktemp)"
  if ! SKIP_BUILD=1 "$root/scripts/package-ui.sh" >/dev/null 2>"$log"; then
    cat "$log" >&2
    rm -f "$log"
    exit 1
  fi
  rm -f "$log"
}

run_package
first="$(manifest_hash)"
run_package
second="$(manifest_hash)"

recomputed="$(
  cd "$package_dir"
  find . -type f ! -path ./manifest.json -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | cut -d' ' -f1
)"

if [[ "$first" != "$second" ]]; then
  echo "check-package-ui: SHA-256 differs between repeated packages ($first != $second)" >&2
  exit 1
fi
if [[ "$second" != "$recomputed" ]]; then
  echo "check-package-ui: manifest sha256 $second does not match recomputed $recomputed" >&2
  exit 1
fi

echo "check-package-ui: OK (sha256 $second; repeated packages and documented recompute match)"
