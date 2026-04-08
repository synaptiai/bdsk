#!/bin/bash
# BDSK scope enforcement hook (PreToolUse on Edit|Write)
# Reads active execution plans and blocks edits to out-of-scope files.
#
# Error policy:
# - No active plans / empty directory → ALLOW (nothing to enforce)
# - Can't parse hook input JSON     → ALLOW (pre-infrastructure, not a plan error)
# - Active plan exists but check errors (Python crash, YAML parse failure,
#   missing artifact, etc.) → BLOCK with warning. If the infrastructure is
#   present but broken, failing open would silently disable all scope enforcement.

set -o pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ACTIVE_DIR="$REPO_ROOT/.claude/state/active-executions"

# Phase 1: No infrastructure → fail-open (nothing to enforce)
if [ ! -d "$ACTIVE_DIR" ] || [ -z "$(ls -A "$ACTIVE_DIR" 2>/dev/null)" ]; then
  exit 0
fi

# Verify python3 and yaml are available before proceeding
if ! python3 -c "import yaml" 2>/dev/null; then
  echo "BDSK WARNING: python3 or PyYAML not available. Scope enforcement disabled." >&2
  exit 0
fi

# Read the file path from stdin (Claude Code hook input is JSON)
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    fp = data.get('tool_input', {}).get('file_path', '')
    print(fp)
except:
    print('')
" 2>/dev/null)

# Can't parse input → fail-open (pre-infrastructure issue, not a plan error)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Phase 2: Active plans exist — errors here should fail-closed
BLOCKED=""
BLOCK_REASON=""
PLAN_CHECKED=false

for plan_file in "$ACTIVE_DIR"/*.yaml; do
  [ -f "$plan_file" ] || continue

  # Read the execution plan ID from the state file
  PLAN_ID=$(BDSK_PLAN_FILE="$plan_file" python3 -c "
import yaml, sys, os
try:
    with open(os.environ['BDSK_PLAN_FILE']) as f:
        data = yaml.safe_load(f)
    print(data.get('execution_plan_id', ''))
except Exception as e:
    print('ERROR:' + str(e), file=sys.stderr)
    print('')
" 2>/dev/null)

  [ -z "$PLAN_ID" ] && continue

  # Find the actual execution plan artifact using YAML-aware lookup
  PLAN_ARTIFACT=$(BDSK_PLAN_ID="$PLAN_ID" BDSK_SEARCH_DIR="$REPO_ROOT/artifacts/execution-plans" python3 -c "
import yaml, sys, os, glob
try:
    search_dir = os.environ['BDSK_SEARCH_DIR']
    target_id = os.environ['BDSK_PLAN_ID']
    for f in sorted(glob.glob(os.path.join(search_dir, '*.yaml'))):
        with open(f) as fh:
            doc = yaml.safe_load(fh)
        if doc and doc.get('id') == target_id:
            print(f)
            sys.exit(0)
    print('')
except Exception as e:
    print('ERROR:' + str(e), file=sys.stderr)
    print('')
" 2>/dev/null)

  if [ -z "$PLAN_ARTIFACT" ]; then
    # Active plan state exists but artifact not found — warn and fail-closed
    echo "BDSK WARNING: Active execution plan '$PLAN_ID' artifact not found. Blocking edit as precaution." >&2
    exit 2
  fi

  # Extract scope and check
  SCOPE_CHECK=$(BDSK_PLAN_ARTIFACT="$PLAN_ARTIFACT" BDSK_FILE_PATH="$FILE_PATH" BDSK_REPO_ROOT="$REPO_ROOT" python3 -c "
import yaml, sys, fnmatch, os

with open(os.environ['BDSK_PLAN_ARTIFACT']) as f:
    plan = yaml.safe_load(f)

if plan.get('status') != 'approved':
    print('ALLOW')
    sys.exit(0)

spec = plan.get('spec', {})
in_scope = spec.get('in_scope_paths', [])
out_of_scope = spec.get('out_of_scope_paths', [])
file_path = os.environ['BDSK_FILE_PATH']
repo_root = os.environ['BDSK_REPO_ROOT']

# Make path relative to repo root if absolute
if file_path.startswith(repo_root):
    file_path = os.path.relpath(file_path, repo_root)

# Governance paths are always writable (process artifacts, not implementation)
governance_prefixes = [
    'artifacts/verifications/',
    'artifacts/execution-evals/',
    'artifacts/acceptance/',
    'artifacts/execution-logs/',
    '.claude/state/active-executions/',
    '.claude/state/change-log.jsonl',
]
for prefix in governance_prefixes:
    if file_path.startswith(prefix) or file_path == prefix.rstrip('/'):
        print('ALLOW')
        sys.exit(0)

# Check out_of_scope first (deny takes priority)
for pattern in out_of_scope:
    if fnmatch.fnmatch(file_path, pattern) or file_path.startswith(pattern):
        print('BLOCK:' + pattern)
        sys.exit(0)

# Check in_scope
if in_scope:
    for pattern in in_scope:
        if fnmatch.fnmatch(file_path, pattern) or file_path.startswith(pattern):
            print('ALLOW')
            sys.exit(0)
    print('BLOCK:not_in_scope')
    sys.exit(0)

print('ALLOW')
")

  SCOPE_EXIT=$?
  # If Python exited non-zero (scope check itself crashed), fail-closed
  if [ $SCOPE_EXIT -ne 0 ] || [ -z "$SCOPE_CHECK" ]; then
    echo "BDSK WARNING: Scope check failed for plan '$PLAN_ID' (exit=$SCOPE_EXIT). Blocking edit as precaution." >&2
    exit 2
  fi

  PLAN_CHECKED=true

  if [[ "$SCOPE_CHECK" == BLOCK:* ]]; then
    BLOCKED="true"
    BLOCK_REASON="${SCOPE_CHECK#BLOCK:}"
    break
  fi
done

if [ -n "$BLOCKED" ]; then
  echo "BDSK: Edit blocked. File is outside execution scope ($BLOCK_REASON). Update the execution plan to include this path." >&2
  exit 2
fi

# Default: allow
exit 0
