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
    # Handle both Edit and Write tool inputs
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
for plan_file in "$ACTIVE_DIR"/*.yaml; do
  [ -f "$plan_file" ] || continue

  PLAN_ID=$(python3 -c "
import yaml, sys
try:
    with open('$plan_file') as f:
        data = yaml.safe_load(f)
    print(data.get('execution_plan_id', ''))
except:
    print('')
" 2>/dev/null)

  [ -z "$PLAN_ID" ] && continue

  # Find the actual execution plan artifact
  PLAN_ARTIFACT=$(find "$REPO_ROOT/artifacts/execution-plans" -name "*.yaml" -exec grep -l "id: $PLAN_ID" {} \; 2>/dev/null | head -1)
  [ -z "$PLAN_ARTIFACT" ] && continue

  # Extract scope paths
  SCOPE_CHECK=$(python3 -c "
import yaml, sys, fnmatch, os

try:
    with open('$PLAN_ARTIFACT') as f:
        plan = yaml.safe_load(f)

    if plan.get('status') != 'approved':
        print('ALLOW')
        sys.exit(0)

    spec = plan.get('spec', {})
    in_scope = spec.get('in_scope_paths', [])
    out_of_scope = spec.get('out_of_scope_paths', [])
    file_path = '$FILE_PATH'

    # Make path relative to repo root if absolute
    repo_root = '$REPO_ROOT'
    if file_path.startswith(repo_root):
        file_path = os.path.relpath(file_path, repo_root)

    # Governance paths are always writable (process artifacts, not implementation)
    # These are where the lifecycle records its own decisions — verification results,
    # gate evaluations, acceptance decisions, execution logs, and state tracking.
    governance_prefixes = [
        'artifacts/verifications/',
        'artifacts/execution-evals/',
        'artifacts/acceptance/',
        'artifacts/execution-logs/',
        '.claude/state/',
    ]
    for prefix in governance_prefixes:
        if file_path.startswith(prefix):
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
        # File not in any in_scope pattern
        print('BLOCK:not_in_scope')
        sys.exit(0)

    # No scope defined, allow
    print('ALLOW')
except Exception as e:
    print('ALLOW')
" 2>/dev/null)

  if [[ "$SCOPE_CHECK" == BLOCK:* ]]; then
    REASON="${SCOPE_CHECK#BLOCK:}"
    echo "BDSK: Edit blocked. File is outside execution scope ($REASON). Update the execution plan to include this path." >&2
    exit 2
  fi
done

# Default: allow
exit 0
