#!/bin/bash
# BDSK artifact schema validation hook (PostToolUse on Write)
# Validates YAML artifacts against JSON schemas after writing.
# Only applies to files in artifacts/**/*.yaml — all other writes pass through.
#
# Exit codes:
#   0 = ALLOW (valid artifact or non-artifact file)
#   2 = BLOCK (schema validation failed)

set -o pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$HOOK_DIR/.." && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Read the file path from stdin (Claude Code hook input is JSON)
INPUT=$(cat)

# Extract file_path — try node first (faster), fall back to python3
if command -v node >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      try{const j=JSON.parse(d);console.log(j.tool_input?.file_path||'')}
      catch{console.log('')}
    })
  " 2>/dev/null)
elif command -v python3 >/dev/null 2>&1; then
  FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys,json
try:
    data=json.load(sys.stdin)
    print(data.get('tool_input',{}).get('file_path',''))
except:
    print('')
" 2>/dev/null)
else
  # No runtime available — allow silently
  exit 0
fi

# No file path parsed — allow
[ -z "$FILE_PATH" ] && exit 0

# Make path relative to repo root
if [[ "$FILE_PATH" == "$REPO_ROOT"* ]]; then
  REL_PATH="${FILE_PATH#$REPO_ROOT/}"
else
  REL_PATH="$FILE_PATH"
fi

# Only validate files under artifacts/**/*.yaml
case "$REL_PATH" in
  artifacts/*.yaml|artifacts/**/*.yaml) ;;
  *) exit 0 ;;
esac

# Check that node is available (required for Ajv validation)
if ! command -v node >/dev/null 2>&1; then
  echo "BDSK WARNING: node not available. Artifact schema validation skipped." >&2
  exit 0
fi

# Run the single-artifact validator (prefer bundle, fall back to unbundled)
BUNDLE="$PLUGIN_ROOT/dist/validate-single-artifact.bundle.js"
UNBUNDLED="$PLUGIN_ROOT/hooks/validate-single-artifact.js"
if [ -f "$BUNDLE" ]; then
  VALIDATOR="$BUNDLE"
elif [ -d "$PLUGIN_ROOT/node_modules/ajv" ]; then
  VALIDATOR="$UNBUNDLED"
else
  echo "BDSK WARNING: Validator not available. Run 'bun run build' in $PLUGIN_ROOT" >&2
  exit 0
fi
RESULT=$(node "$VALIDATOR" "$FILE_PATH" "$PLUGIN_ROOT/schemas" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "BDSK: Artifact schema validation failed for $REL_PATH" >&2
  echo "$RESULT" >&2
  echo "" >&2
  echo "Fix the artifact to match the schema and retry." >&2
  exit 2
fi

exit 0
