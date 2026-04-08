---
name: validate
description: |
  Lightweight BDSK validator. Scans artifacts/ for schema validity,
  trace integrity, approval states, and coverage. Reports findings
  using BDSK error codes. Use before /accept.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# /validate

Run BDSK validation on all artifacts.

## Process

1. **Try the full validator first.** Run the TypeScript 8-phase validator:

```bash
bun run src/cli.ts . --format text --verbose
```

If this succeeds (exit code 0 or 1), display the output and stop. The full validator covers all 8 phases:
- V1: Artifact discovery and duplicate ID checking
- V2: JSON Schema validation against kind-specific schemas
- V3: Trace structure and edge-kind compatibility
- V4: Referential integrity (RI-1 through RI-10)
- V5: Authority validation (AU-1, AU-3, AU-4, AU-5)
- V6: Execution conformance (Algorithms A, B, C)
- V7: Verification coverage (Algorithm D)
- V8: Acceptance validation (Algorithm E)

2. **Fallback: lightweight validation.** If `bun` is not available or the validator fails with exit code 2 (internal error), fall back to manual checks:

   a. **Discover artifacts.** Glob `artifacts/**/*.yaml`. Parse as YAML. Skip files without a `kind` field.

   b. **Build an index.** Map each artifact by `id` and `kind`. Check for duplicate IDs (BDSK-SCHEMA-001).

   c. **Schema check.** For each artifact, verify:
      - `schema_version` is "0.3" (BDSK-SCHEMA-003)
      - All required envelope fields present: kind, schema_version, id, title, status, owners, created_at, updated_at, trace, spec (BDSK-SCHEMA-002)
      - `trace` has both `upstream` and `downstream` arrays (BDSK-TRACE-001)
      - All trace edges use canonical vocabulary (BDSK-TRACE-002)

   d. **Referential integrity.** For each trace reference:
      - Check `target_id` resolves to an artifact in the index (BDSK-REF-001)
      - Check governing artifacts are in approved/accepted status (BDSK-REF-002)

   e. **Verification coverage.** For each approved execution plan:
      - Check each behavior spec in `required_inputs.behaviors` has a verification_artifact (BDSK-REF-003)

3. **Report findings.** Display summary in the standard format.

## Rules

- Prefer the full 8-phase validator when available — it catches more issues
- The full validator produces deterministic output matching the conformance report schema
- Fallback mode checks V1-V4 only (no authority, execution, or acceptance checks)
- Report ALL errors found, don't stop at the first one
