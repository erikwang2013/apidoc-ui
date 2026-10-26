#!/usr/bin/env bash
# Build the shared UIC-1 Vue UI and collect it into dist/uic1-ui/ with a
# manifest.json. Optionally copy the package into existing destination
# directories (repeatable); without --dest it never writes outside this repo.
#
# Requires bash >= 4.4 and GNU coreutils (sha256sum, sort -z, xargs -0).
# The manifest sha256 is computed over the sorted (relative path, sha256)
# list of packaged files, so it is reproducible from the package directory:
#   cd dist/uic1-ui && find . -type f ! -path ./manifest.json -print0 \
#     | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum
set -euo pipefail

if ((BASH_VERSINFO[0] < 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] < 4))); then
  echo "package-ui: bash >= 4.4 required" >&2
  exit 1
fi
command -v sha256sum >/dev/null || {
  echo "package-ui: GNU coreutils sha256sum is required" >&2
  exit 1
}

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="$root/apidoc"
package_dir="$root/dist/uic1-ui"

usage() {
  cat <<'EOF'
Usage: scripts/package-ui.sh [options] [DEST...]

Build the shared UIC-1 UI and package it in dist/uic1-ui/ (build contents plus
manifest.json: version, name, builtAt, gitCommit, sha256).

Options:
  --dest DIR   Copy the package into an existing directory that is empty or is
               a previous uic1-ui package (manifest.json name "uic1-ui").
               Repeatable; positional arguments are also destinations.
  -h, --help   Show this help.

Environment:
  SKIP_BUILD=1  Reuse the existing apidoc/ build instead of running npm run
                build. The build's config.js?v is checked against package.json;
                manifest version/gitCommit/builtAt still describe this
                packaging checkout and time, not the reused build.

Requires bash >= 4.4 and GNU coreutils (sha256sum, sort -z, xargs -0).

Examples:
  scripts/package-ui.sh
  scripts/package-ui.sh --dest /srv/apidoc /srv/apidoc-legacy
EOF
}

is_empty_dir() {
  [[ -z "$(find "$1" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]
}

is_uic1_package() {
  [[ -f "$1/manifest.json" ]] &&
    node -e 'process.exit(require(process.argv[1]).name === "uic1-ui" ? 0 : 1)' \
      "$1/manifest.json" 2>/dev/null
}

destinations=()
while (($#)); do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --dest)
      if (($# < 2)); then
        echo "package-ui: --dest requires a directory" >&2
        exit 2
      fi
      destinations+=("$2")
      shift 2
      ;;
    --dest=*)
      destinations+=("${1#--dest=}")
      shift
      ;;
    --)
      shift
      while (($#)); do
        destinations+=("$1")
        shift
      done
      ;;
    -*)
      echo "package-ui: unknown option: $1 (try --help)" >&2
      exit 2
      ;;
    *)
      destinations+=("$1")
      shift
      ;;
  esac
done

# Refuse missing destinations instead of creating them, and only overwrite an
# empty directory or a previous uic1-ui package: a typo must not replace an
# unrelated site's index.html.
for dest in "${destinations[@]}"; do
  if [[ -z "$dest" ]]; then
    echo "package-ui: destination is empty" >&2
    exit 1
  fi
  if [[ ! -d "$dest" ]]; then
    echo "package-ui: destination is not an existing directory: '$dest' (create it first)" >&2
    exit 1
  fi
  if ! is_empty_dir "$dest" && ! is_uic1_package "$dest"; then
    echo "package-ui: destination is not empty and is not a previous uic1-ui package: '$dest'" >&2
    echo "package-ui: deploy into an empty directory, or back up and clear the old UI first" >&2
    exit 1
  fi
done

version="$(cd "$root" && node -p "require('./package.json').version")"

if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  if [[ ! -f "$build_dir/index.html" ]]; then
    echo "package-ui: SKIP_BUILD=1 but $build_dir/index.html is missing; run npm run build first" >&2
    exit 1
  fi
  build_version="$(grep -o 'config\.js?v=[0-9A-Za-z._+-]*' "$build_dir/index.html" | head -1 | cut -d= -f2 || true)"
  if [[ -z "$build_version" ]]; then
    echo "package-ui: cannot read the build version from $build_dir/index.html; run npm run build" >&2
    exit 1
  fi
  if [[ "$build_version" != "$version" ]]; then
    echo "package-ui: apidoc/ was built for version $build_version but package.json is $version; run npm run build" >&2
    exit 1
  fi
  echo "package-ui: WARN SKIP_BUILD=1 reuses apidoc/; manifest version/gitCommit/builtAt describe this packaging checkout and time, not necessarily the reused build" >&2
else
  (cd "$root" && npm run build)
fi

git_commit="$(git -C "$root" rev-parse HEAD 2>/dev/null || echo unknown)"
built_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$root/dist"
staging="$(mktemp -d "$root/dist/.uic1-ui.XXXXXX")"
trap 'rm -rf "$staging"' EXIT

cp -a "$build_dir/." "$staging/"

# Content-only hash: file mtimes and directory order do not affect it.
sha256="$(
  cd "$staging"
  find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | cut -d' ' -f1
)"

cat >"$staging/manifest.json" <<EOF
{
  "version": "$version",
  "name": "uic1-ui",
  "builtAt": "$built_at",
  "gitCommit": "$git_commit",
  "sha256": "$sha256"
}
EOF

rm -rf "$package_dir"
mv "$staging" "$package_dir"
trap - EXIT

echo "packaged $package_dir (version $version, sha256 $sha256)"

for dest in "${destinations[@]}"; do
  cp -a "$package_dir/." "$dest/"
  echo "copied to $dest"
done
