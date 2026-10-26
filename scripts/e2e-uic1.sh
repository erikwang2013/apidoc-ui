#!/usr/bin/env bash
# UIC-1 E2E (Phase 1 + Phase 2 management): live PHP fixture server +
# Go/Rust UIC-1 route tests.
#
#   scripts/e2e-uic1.sh
#
# Worktrees default to the siblings of this repo (<root>/php, <root>/go,
# <root>/rust); override with APIDOC_PHP_DIR / APIDOC_GO_DIR / APIDOC_RUST_DIR.
# The PHP port defaults to 18091; override with UIC1_PHP_PORT.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TREES="${APIDOC_UIC1_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PHP_DIR="${APIDOC_PHP_DIR:-$TREES/php}"
GO_DIR="${APIDOC_GO_DIR:-$TREES/go}"
RUST_DIR="${APIDOC_RUST_DIR:-$TREES/rust}"
PHP_HOST="${UIC1_PHP_HOST:-127.0.0.1}"
# 18081 is often occupied by an unrelated local server; keep 18091 as the
# default and allow an override for CI or other hosts.
PHP_PORT="${UIC1_PHP_PORT:-18091}"
GO_TIMEOUT="${UIC1_GO_TIMEOUT:-900}"
RUST_TIMEOUT="${UIC1_RUST_TIMEOUT:-1800}"
BASE="http://$PHP_HOST:$PHP_PORT/apidoc/ui/v1"

TMP_DIR="$(mktemp -d)"
PHP_PID=""
PHP_OPEN_PID=""
STARTED_PID=""
PHP_OK=1
# Second fixture server with global auth off (see tests/fixtures/ui_server.php).
PHP_OPEN_PORT="${UIC1_PHP_OPEN_PORT:-$((PHP_PORT + 1))}"

stop_php_pid() { # label pid port
  local label="$1" pid="$2" port="$3"
  [[ -n "$pid" ]] || return 0
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  echo "$label: stopped server pid $pid"
  local i
  for i in $(seq 1 25); do
    if ! (exec 3<>"/dev/tcp/$PHP_HOST/$port") 2>/dev/null; then
      echo "$label: port $port closed"
      return 0
    fi
    sleep 0.2
  done
  echo "$label: WARN port $port still accepting after server stop"
}

# Only ever kills the PHP servers this script started.
stop_php() {
  local pid="$PHP_PID"
  PHP_PID=""
  stop_php_pid "php" "$pid" "$PHP_PORT"
}
stop_php_open() {
  local pid="$PHP_OPEN_PID"
  PHP_OPEN_PID=""
  stop_php_pid "php-open" "$pid" "$PHP_OPEN_PORT"
}

cleanup() {
  local status=$?
  trap - EXIT
  stop_php
  stop_php_open
  rm -rf -- "$TMP_DIR"
  exit "$status"
}
trap cleanup EXIT

req() { # method url [json-data] [token] -> echoes HTTP status, body in $TMP_DIR/body
  local method="$1" url="$2" data="${3:-}" token="${4:-}"
  local args=(-sS --max-time 15 -o "$TMP_DIR/body" -w '%{http_code}' -X "$method")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$data" ]] && args+=(-H 'Content-Type: application/json' -d "$data")
  : >"$TMP_DIR/body"
  curl "${args[@]}" "$url" || echo '000'
}

check_php() { # name want-http jq-expr http-status
  local name="$1" want_http="$2" expr="$3" code="$4"
  if [[ "$code" == "$want_http" ]] && jq -e "$expr" "$TMP_DIR/body" >/dev/null 2>&1; then
    echo "PASS php: $name"
  else
    echo "FAIL php: $name (http $code, want $want_http) [$(head -c 300 "$TMP_DIR/body")]"
    PHP_OK=0
  fi
}

# Starts tests/fixtures/ui_server.php on a port, waits until ready, and sets
# STARTED_PID. Refuses a busy port instead of touching another process.
start_php_server() { # port log [env-assignment]
  local port="$1" log="$2" env_pair="${3:-}" i
  if (exec 3<>"/dev/tcp/$PHP_HOST/$port") 2>/dev/null; then
    echo "FAIL php: $PHP_HOST:$port already in use; refusing to touch another process (set UIC1_PHP_PORT/UIC1_PHP_OPEN_PORT)"
    return 1
  fi
  if [[ -n "$env_pair" ]]; then
    (cd "$PHP_DIR" && exec env "$env_pair" php -S "$PHP_HOST:$port" tests/fixtures/ui_server.php) \
      >"$log" 2>&1 &
  else
    (cd "$PHP_DIR" && exec php -S "$PHP_HOST:$port" tests/fixtures/ui_server.php) \
      >"$log" 2>&1 &
  fi
  STARTED_PID=$!
  for i in $(seq 1 100); do
    if curl -sf --max-time 1 -o /dev/null "http://$PHP_HOST:$port/apidoc/ui/v1/capabilities"; then
      return 0
    fi
    kill -0 "$STARTED_PID" 2>/dev/null || break
    sleep 0.2
  done
  echo "FAIL php: server on $PHP_HOST:$port did not become ready"
  tail -n 20 "$log"
  return 1
}

php_e2e() {
  local server="$PHP_DIR/tests/fixtures/ui_server.php"
  if ! command -v php >/dev/null || ! command -v curl >/dev/null || ! command -v jq >/dev/null; then
    echo "FAIL php: php, curl and jq are required"
    return 1
  fi
  if [[ ! -f "$server" ]]; then
    echo "FAIL php: missing $server"
    return 1
  fi
  if ! start_php_server "$PHP_PORT" "$TMP_DIR/php-server.log"; then
    stop_php_pid "php" "$STARTED_PID" "$PHP_PORT"
    STARTED_PID=""
    return 1
  fi
  PHP_PID="$STARTED_PID"
  STARTED_PID=""

  check_php "capabilities" 200 \
    '.code==0 and .data.contract=="1.0" and .data.backend=="php" and .data.features.auth.global==true' \
    "$(req GET "$BASE/capabilities")"

  check_php "verifyAuth rejects wrong password" 402 \
    '.code==4002' \
    "$(req POST "$BASE/verifyAuth" '{"password":"wrong"}')"

  check_php "verifyAuth issues token" 200 \
    '.code==0 and (.data.token | type=="string") and (.data.token | length>0)' \
    "$(req POST "$BASE/verifyAuth" '{"password":"pw"}')"
  local token
  token="$(jq -r '.data.token // empty' "$TMP_DIR/body")"

  check_php "config requires auth" 401 \
    '.code==4001' \
    "$(req GET "$BASE/config?appKey=default")"

  check_php "config with Bearer token" 200 \
    '.code==0 and .data.title=="UIC-1 E2E" and .data.apps[0].key=="default"' \
    "$(req GET "$BASE/config?appKey=default" '' "$token")"

  check_php "menus" 200 \
    '.code==0 and (.data.data | length >= 1)' \
    "$(req POST "$BASE/menus" '{"appKey":"default"}' "$token")"
  local menu_key
  menu_key="$(jq -r '.data.data[0].children[0].menuKey // empty' "$TMP_DIR/body")"
  if [[ -z "$menu_key" ]]; then
    echo "FAIL php: menus returned no menuKey"
    PHP_OK=0
  fi

  check_php "detail" 200 \
    '.code==0 and .data.name=="listUsers" and .data.url=="/users"' \
    "$(req POST "$BASE/detail" "$(jq -cn --arg k "$menu_key" '{appKey:"default",path:$k}')" "$token")"

  # --- Phase 2 management ---

  check_php "capabilities management" 200 \
    '.code==0 and .data.features.share.records==true and .data.features.cache.manage==true and .data.features.generator.templates==true and .data.features.auth.shareToken==true' \
    "$(req GET "$BASE/capabilities")"

  local share_name="UIC-1 E2E share" share_key="" share_token="" share_menu_key="" app_token=""
  check_php "share add" 200 \
    '.code==0 and .data==true' \
    "$(req POST "$BASE/addApiShare" "$(jq -cn --arg n "$share_name" '{name:$n,type:"app",appKeys:["default"],password:"share-pw"}')" "$token")"

  check_php "share list" 200 \
    '.code==0 and .data.total>=1 and ([.data.data[] | select(.name=="UIC-1 E2E share")] | length)==1' \
    "$(req POST "$BASE/getApiShareList" '{"pageIndex":1}' "$token")"
  share_key="$(jq -r '.data.data[] | select(.name=="UIC-1 E2E share") | .key' "$TMP_DIR/body" | head -n1)"

  check_php "share detail" 200 \
    '.code==0 and .data.name=="UIC-1 E2E share" and .data.type=="app" and (.data|has("password")|not)' \
    "$(req POST "$BASE/getApiShareDetail" "$(jq -cn --arg k "$share_key" '{key:$k}')" "$token")"

  check_php "share login" 200 \
    '.code==0 and (.data.token|type=="string") and (.data.token|length>0)' \
    "$(req POST "$BASE/verifyAuth" "$(jq -cn --arg k "$share_key" '{shareKey:$k,password:"share-pw"}')")"
  share_token="$(jq -r '.data.token // empty' "$TMP_DIR/body")"

  check_php "share config scope" 200 \
    '.code==0 and .data.title=="UIC-1 E2E" and .data.apps[0].key=="default"' \
    "$(req GET "$BASE/config?appKey=default&shareKey=$share_key" '' "$share_token")"

  check_php "share menus scope" 200 \
    '.code==0 and (.data.data|length>=1)' \
    "$(req POST "$BASE/menus" "$(jq -cn --arg k "$share_key" '{appKey:"default",shareKey:$k}')" "$share_token")"
  share_menu_key="$(jq -r '.data.data[0].children[0].menuKey // empty' "$TMP_DIR/body")"

  check_php "share detail scope" 200 \
    '.code==0 and .data.name=="listUsers"' \
    "$(req POST "$BASE/detail" "$(jq -cn --arg k "$share_key" --arg p "$share_menu_key" '{appKey:"default",shareKey:$k,path:$p}')" "$share_token")"

  check_php "cache clear" 200 \
    '.code==0 and .data.ok==true and .data.mode=="server"' \
    "$(req POST "$BASE/cache/clear" '{}' "$token")"

  check_php "cache warm" 200 \
    '.code==0 and .data.ok==true and .data.mode=="server"' \
    "$(req POST "$BASE/cache/warm" '{}' "$token")"

  check_php "exportAllData" 200 \
    '.code==0 and (.data.apiData|type=="array") and ([.data.apiData[] | .. | objects | select(.name=="listUsers" and .url=="/users")]|length>=1)' \
    "$(req POST "$BASE/exportAllData" '{"appKey":"default"}' "$token")"

  # Owner export by share key: global token only, filtered to the share's apps.
  check_php "share owner export" 200 \
    '.code==0 and ([.data.apiData[] | select(.appKey=="default")] | length)==1 and ([.data.apiData[] | select(.appKey=="secure")] | length)==0 and ([.data.apiData[] | .. | objects | select(.name=="listUsers")] | length)>=1 and (.data|tostring|contains("app-pw")|not)' \
    "$(req POST "$BASE/exportAllData" "$(jq -cn --arg k "$share_key" '{key:$k}')" "$token")"

  # Share viewer export: share token + shareKey, same app scope.
  check_php "share viewer export" 200 \
    '.code==0 and ([.data.apiData[] | select(.appKey=="default")] | length)==1 and ([.data.apiData[] | select(.appKey=="secure")] | length)==0 and (.data|tostring|contains("app-pw")|not)' \
    "$(req POST "$BASE/exportAllData" "$(jq -cn --arg k "$share_key" '{shareKey:$k,appKey:"default"}')" "$share_token")"

  # An app password token must never pass the global-only management guard.
  check_php "app login" 200 \
    '.code==0 and (.data.token|type=="string") and (.data.token|length>0)' \
    "$(req POST "$BASE/verifyAuth" '{"password":"app-pw","appKey":"secure"}')"
  app_token="$(jq -r '.data.token // empty' "$TMP_DIR/body")"

  check_php "app token rejected: share add" 401 \
    '.code==4001' \
    "$(req POST "$BASE/addApiShare" '{"appKey":"secure","name":"evil","type":"all"}' "$app_token")"

  check_php "app token rejected: share list" 401 \
    '.code==4001' \
    "$(req POST "$BASE/getApiShareList" '{"appKey":"secure","pageIndex":1}' "$app_token")"

  check_php "app token rejected: share detail" 401 \
    '.code==4001' \
    "$(req POST "$BASE/getApiShareDetail" '{"appKey":"secure","key":"not-a-share"}' "$app_token")"

  check_php "app token rejected: share delete" 401 \
    '.code==4001' \
    "$(req POST "$BASE/deleteApiShare" '{"appKey":"secure","key":"not-a-share"}' "$app_token")"

  check_php "app token rejected: cache clear" 401 \
    '.code==4001' \
    "$(req POST "$BASE/cache/clear" '{"appKey":"secure"}' "$app_token")"

  check_php "app token rejected: cache warm" 401 \
    '.code==4001' \
    "$(req POST "$BASE/cache/warm" '{"appKey":"secure"}' "$app_token")"

  check_php "app token rejected: generator" 401 \
    '.code==4001' \
    "$(req POST "$BASE/generator" '{"appKey":"secure","index":0}' "$app_token")"

  check_php "app token rejected: exportAllData key" 401 \
    '.code==4001' \
    "$(req POST "$BASE/exportAllData" "$(jq -cn --arg k "$share_key" '{appKey:"secure",key:$k}')" "$app_token")"

  check_php "share delete" 200 \
    '.code==0 and .data==true' \
    "$(req POST "$BASE/deleteApiShare" "$(jq -cn --arg k "$share_key" '{key:$k}')" "$token")"

  check_php "share detail after delete" 404 \
    '.code!=0' \
    "$(req POST "$BASE/getApiShareDetail" "$(jq -cn --arg k "$share_key" '{key:$k}')" "$token")"

  # --- I2: global auth off; anonymous export must omit password-protected apps ---
  if start_php_server "$PHP_OPEN_PORT" "$TMP_DIR/php-open.log" "UIC1_FIXTURE_OPEN=1"; then
    PHP_OPEN_PID="$STARTED_PID"
    STARTED_PID=""
    local open_base="http://$PHP_HOST:$PHP_OPEN_PORT/apidoc/ui/v1"
    check_php "anonymous export omits protected app" 200 \
      '.code==0 and ([.data.apiData[] | select(.appKey=="default")] | length)==1 and ([.data.apiData[] | select(.appKey=="secure")] | length)==0 and (.data|tostring|contains("app-pw")|not)' \
      "$(req POST "$open_base/exportAllData" '{}')"
    check_php "anonymous protected-app export is 401" 401 \
      '.code==4001' \
      "$(req POST "$open_base/exportAllData" '{"appKey":"secure"}')"
    stop_php_open
  else
    stop_php_pid "php-open" "$STARTED_PID" "$PHP_OPEN_PORT"
    STARTED_PID=""
    PHP_OK=0
  fi

  stop_php
  return $((PHP_OK == 1 ? 0 : 1))
}

run_tests() { # label dir timeout-seconds command...
  local label="$1" dir="$2" tmo="$3"
  shift 3
  if [[ ! -d "$dir" ]]; then
    echo "FAIL $label: missing worktree $dir"
    return 1
  fi
  if ! command -v timeout >/dev/null; then
    echo "FAIL $label: coreutils timeout is required"
    return 1
  fi
  echo "=== $label: $* (timeout ${tmo}s) ==="
  local log="$TMP_DIR/$label.log" attempt
  for attempt in 1 2; do
    if (cd "$dir" && timeout "$tmo" "$@") 2>&1 | tee "$log"; then
      echo "PASS $label"
      return 0
    fi
    if [[ "$attempt" == 1 ]] && grep -Eqi 'blocking waiting for file lock|timed out|signal: terminated' "$log"; then
      echo "$label: blocked on a build lock or timeout, retrying once in 10s"
      sleep 10
      continue
    fi
    break
  done
  echo "FAIL $label (last output above, full log $(wc -l <"$log") lines)"
  return 1
}

go_e2e() {
  command -v go >/dev/null || {
    echo "FAIL go: go is not installed"
    return 1
  }
  run_tests "go" "$GO_DIR" "$GO_TIMEOUT" go test ./server/uiapi
}

rust_e2e() {
  command -v cargo >/dev/null || {
    echo "FAIL rust: cargo is not installed"
    return 1
  }
  run_tests "rust" "$RUST_DIR" "$RUST_TIMEOUT" \
    cargo test -p apidoc-rust --test uic1_routes --test uic1_debug_scope \
    --test uic1_management --features axum
}

overall=1
if php_e2e; then echo "RESULT php: PASS"; else echo "RESULT php: FAIL"; overall=0; fi
if go_e2e; then echo "RESULT go: PASS"; else echo "RESULT go: FAIL"; overall=0; fi
if rust_e2e; then echo "RESULT rust: PASS"; else echo "RESULT rust: FAIL"; overall=0; fi

if [[ "$overall" == 1 ]]; then
  echo "E2E: PASS"
  exit 0
fi
echo "E2E: FAIL"
exit 1
