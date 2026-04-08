#!/bin/bash
# BDSK hook test suite
# Tests check-scope.sh and log-change.sh with various inputs

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_DIR="$REPO_ROOT/.claude/hooks"
STATE_DIR="$REPO_ROOT/.claude/state"
FIXTURE_DIR="$REPO_ROOT/test/fixtures"
PASS=0
FAIL=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }

assert_exit() {
  local test_name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    green "PASS: $test_name"
    PASS=$((PASS + 1))
  else
    red "FAIL: $test_name (expected exit $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

# Setup: create temporary active execution state
setup() {
  mkdir -p "$STATE_DIR/active-executions"
  cp "$FIXTURE_DIR/execution-plans/test-plan.yaml" "$REPO_ROOT/artifacts/execution-plans/EP-test-001.yaml"
  cat > "$STATE_DIR/active-executions/EP-test-001.yaml" <<EOF
execution_plan_id: EP-test-001
activated_at: "2026-04-08T00:00:00Z"
EOF
}

# Teardown: remove temporary state
teardown() {
  rm -f "$STATE_DIR/active-executions/EP-test-001.yaml"
  rm -f "$REPO_ROOT/artifacts/execution-plans/EP-test-001.yaml"
  rm -f "$STATE_DIR/change-log.jsonl"
}

make_input() {
  local file_path="$1"
  echo "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$file_path\"}}"
}

echo "=== BDSK Hook Tests ==="
echo ""

# ---- check-scope.sh tests ----

echo "--- check-scope.sh ---"

# Test 1: No active executions -> allow all
teardown
make_input "$REPO_ROOT/anything.txt" | "$HOOK_DIR/check-scope.sh" >/dev/null 2>&1 ; rc=$?
assert_exit "No active executions allows all edits" "0" "$rc"

# Test 2: In-scope file -> allow
setup
make_input "$REPO_ROOT/src/index.ts" | "$HOOK_DIR/check-scope.sh" >/dev/null 2>&1 ; rc=$?
assert_exit "In-scope file (src/) is allowed" "0" "$rc"

# Test 3: Out-of-scope file -> block
setup
make_input "$REPO_ROOT/bdsk_specification_v_0.md" | "$HOOK_DIR/check-scope.sh" >/dev/null 2>&1 ; rc=$?
assert_exit "Out-of-scope file (spec) is blocked" "2" "$rc"

# Test 4: Out-of-scope directory -> block
setup
make_input "$REPO_ROOT/schemas/common.json" | "$HOOK_DIR/check-scope.sh" >/dev/null 2>&1 ; rc=$?
assert_exit "Out-of-scope directory (schemas/) is blocked" "2" "$rc"

# Test 5: File not matching any scope pattern -> block
setup
make_input "$REPO_ROOT/random-file.txt" | "$HOOK_DIR/check-scope.sh" >/dev/null 2>&1 ; rc=$?
assert_exit "File not in any in_scope_paths is blocked" "2" "$rc"

# Test 6: Empty/malformed JSON input -> allow (fail-open)
setup
echo "not json" | "$HOOK_DIR/check-scope.sh" >/dev/null 2>&1 ; rc=$?
assert_exit "Malformed JSON input defaults to allow" "0" "$rc"

# Test 7: Empty input -> allow (fail-open)
setup
echo "" | "$HOOK_DIR/check-scope.sh" >/dev/null 2>&1 ; rc=$?
assert_exit "Empty input defaults to allow" "0" "$rc"

# ---- log-change.sh tests ----

echo ""
echo "--- log-change.sh ---"

# Test 8: No active executions -> exits cleanly
teardown
make_input "$REPO_ROOT/src/index.ts" | "$HOOK_DIR/log-change.sh" >/dev/null 2>&1 ; rc=$?
assert_exit "Log hook exits cleanly with no active executions" "0" "$rc"

# Test 9: Active execution -> logs the change
setup
make_input "$REPO_ROOT/src/index.ts" | "$HOOK_DIR/log-change.sh" >/dev/null 2>&1 ; rc=$?
assert_exit "Log hook exits cleanly with active execution" "0" "$rc"

if [ -f "$STATE_DIR/change-log.jsonl" ]; then
  if grep -q "src/index.ts" "$STATE_DIR/change-log.jsonl"; then
    green "PASS: Change log contains the edited file path"
    PASS=$((PASS + 1))
  else
    red "FAIL: Change log exists but doesn't contain file path"
    FAIL=$((FAIL + 1))
  fi
else
  red "FAIL: Change log file was not created"
  FAIL=$((FAIL + 1))
fi

# Teardown
teardown

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
