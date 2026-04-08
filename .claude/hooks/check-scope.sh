#!/bin/bash
# BDSK scope enforcement hook (PreToolUse on Edit|Write)
# Reads active execution plans and blocks edits to out-of-scope files.
# CRITICAL: On ANY error, default to ALLOW (exit 0). Never block development
# due to a hook malfunction.

set -o pipefail
trap 'exit 0' ERR

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ACTIVE_DIR="$REPO_ROOT/.claude/state/active-executions"

# If no active executions directory or it's empty, allow everything
if [ ! -d "$ACTIVE_DIR" ] || [ -z "$(ls -A "$ACTIVE_DIR" 2>/dev/null)" ]; then
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

# If we couldn't parse the file path, allow (don't block on parse errors)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Check each active execution plan
# Semantics: if ANY plan blocks, the edit is blocked (union of restrictions)
BLOCKED=""
BLOCK_REASON=""

for plan_file in "$ACTIVE_DIR"/*.yaml; do
  [ -f "$plan_file" ] || continue

  # Use env vars to avoid shell injection into Python source
  PLAN_ID=$(BDSK_PLAN_FILE="$plan_file" python3 -c "
import yaml, sys, os
try:
    with open(os.environ['BDSK_PLAN_FILE']) as f:
        data = yaml.safe_load(f)
    print(data.get('execution_plan_id', ''))
except:
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
except:
    print('')
" 2>/dev/null)

  [ -z "$PLAN_ARTIFACT" ] && continue

  # Extract scope and check — pass all values via env vars
  SCOPE_CHECK=$(BDSK_PLAN_ARTIFACT="$PLAN_ARTIFACT" BDSK_FILE_PATH="$FILE_PATH" BDSK_REPO_ROOT="$REPO_ROOT" python3 -c "
import yaml, sys, fnmatch, os

try:
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
except Exception as e:
    print('ALLOW')
" 2>/dev/null)

  if [[ "$SCOPE_CHECK" == BLOCK:* ]]; then
    BLOCKED="true"
    BLOCK_REASON="${SCOPE_CHECK#BLOCK:}"
    break  # Any plan that blocks is sufficient to deny
  fi
done

if [ -n "$BLOCKED" ]; then
  echo "BDSK: Edit blocked. File is outside execution scope ($BLOCK_REASON). Update the execution plan to include this path." >&2
  exit 2
fi

# Default: allow
exit 0
