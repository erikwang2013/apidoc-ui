#!/usr/bin/env bash
# Build the shared UIC-1 Vue UI and collect it into dist/uic1-ui/ with a
# manifest.json. Optionally copy the package into existing destination
# directories (repeatable); without --dest it never writes outside this repo.
#
# The manifest sha256 is computed over the sorted (relative path, sha256)
# list of packaged files, so it is reproducible from the package directory:
#   cd dist/uic1-ui && find . -type f ! -path ./manifest.json -print0 \
#     | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="$root/apidoc"
package_dir="$root/dist/uic1-ui"

usage() {
  cat <<'EOF'
Usage: scripts/package-ui.sh [options] [DEST...]

Build the shared UIC-1 UI and package it in dist/uic1-ui/ (build contents plus
manifest.json: version, name, builtAt, gitCommit, sha256).

Options:
  --dest DIR   Copy the package into an existing directory (repeatable).
               Positional arguments are treated as destinations as well.
  -h, --help   Show this help.

Environment:
  SKIP_BUILD=1  Reuse the existing apidoc/ build instead of running npm run build.

Examples:
  scripts/package-ui.sh
  scripts/package-ui.sh --dest /srv/apidoc /srv/apidoc-legacy
EOF
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

# Refuse missing destinations instead of creating them: a typo must not scatter
# builds into arbitrary directories.
for dest in "${destinations[@]}"; do
  if [[ -z "$dest" || ! -d "$dest" ]]; then
    echo "package-ui: destination is empty or not an existing directory: '$dest'" >&2
    exit 1
  fi
done

if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  if [[ ! -f "$build_dir/index.html" ]]; then
    echo "package-ui: SKIP_BUILD=1 but $build_dir/index.html is missing; run npm run build first" >&2
    exit 1
  fi
else
  (cd "$root" && npm run build)
fi

version="$(cd "$root" && node -p "require('./package.json').version")"
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
