#!/bin/bash
# BDSK change logging hook (PostToolUse on Edit|Write)
# Appends file changes to a JSONL log for execution tracking.
# Non-blocking: errors are silently ignored.

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ACTIVE_DIR="$REPO_ROOT/.claude/state/active-executions"
LOG_DIR="$REPO_ROOT/.claude/state"

# If no active executions, skip silently
if [ ! -d "$ACTIVE_DIR" ] || [ -z "$(ls -A "$ACTIVE_DIR" 2>/dev/null)" ]; then
  exit 0
fi

# Read the file path from stdin
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

[ -z "$FILE_PATH" ] && exit 0

# Make path relative
if [[ "$FILE_PATH" == "$REPO_ROOT"* ]]; then
  FILE_PATH="${FILE_PATH#$REPO_ROOT/}"
fi

# Append to change log with proper JSON escaping
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BDSK_FILE="$FILE_PATH" BDSK_TS="$TIMESTAMP" python3 -c "
import json, os, sys
try:
    entry = json.dumps({'file': os.environ['BDSK_FILE'], 'timestamp': os.environ['BDSK_TS'], 'action': 'edit'})
    print(entry)
except:
    pass
" >> "$LOG_DIR/change-log.jsonl" 2>/dev/null

exit 0
