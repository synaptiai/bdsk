#!/bin/bash
# BDSK phase-level artifact validator.
# Called explicitly by the /run skill after each artifact-writing phase.
#
# Usage: validate-phase-artifact.sh <artifact-path>
# Exit 0 = valid, Exit 1 = invalid (errors on stderr)

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$1" ]; then
  echo "Usage: validate-phase-artifact.sh <artifact-path>" >&2
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "BDSK: Artifact not found: $1" >&2
  exit 1
fi

# Check node is available
if ! command -v node >/dev/null 2>&1; then
  echo "BDSK WARNING: node not available. Phase validation skipped." >&2
  exit 0
fi

# Prefer bundled validator, fall back to unbundled
BUNDLE="$PLUGIN_ROOT/dist/validate-single-artifact.bundle.js"
UNBUNDLED="$PLUGIN_ROOT/hooks/validate-single-artifact.js"
if [ -f "$BUNDLE" ]; then
  VALIDATOR="$BUNDLE"
elif [ -d "$PLUGIN_ROOT/node_modules/ajv" ]; then
  VALIDATOR="$UNBUNDLED"
else
  echo "BDSK WARNING: Validator not available. Phase validation skipped." >&2
  exit 0
fi

node "$VALIDATOR" "$1" "$PLUGIN_ROOT/schemas"
