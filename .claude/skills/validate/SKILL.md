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

Run lightweight validation on all BDSK artifacts.

## Process

1. **Discover artifacts.** Glob `artifacts/**/*.yaml`. For each file, parse as YAML. Skip files that don't have a `kind` field.

2. **Build an index.** Map each artifact by `id` and `kind`. Check for duplicate IDs (BDSK-SCHEMA-001).

3. **Schema check.** For each artifact, verify:
   - `schema_version` is "0.3" (BDSK-SCHEMA-003)
   - All required envelope fields are present: kind, schema_version, id, title, status, owners, created_at, updated_at, trace, spec (BDSK-SCHEMA-002)
   - `trace` has both `upstream` and `downstream` arrays (BDSK-TRACE-001)
   - All trace edges use canonical vocabulary: depends_on, derived_from, constrains, implements, proves, evaluates, produced_by, supersedes, escalates_to, waives (BDSK-TRACE-002)

4. **Referential integrity.** For each trace reference:
   - Check that `target_id` resolves to an artifact in the index or is a canonical rule ID `bdsk:rule:*` (BDSK-REF-001)
   - Check that referenced governing artifacts (for execution plans) are in approved/accepted status (BDSK-REF-002)

5. **Verification coverage.** For each execution plan with status approved or completed:
   - Check that each behavior spec in `required_inputs.behaviors` has at least one verification_artifact that proves it (BDSK-REF-003)

6. **Report findings.** Output a summary:

```
BDSK Validation Report
======================
Artifacts scanned: N
Schema errors: N
Trace errors: N
Reference errors: N

Findings:
  [ERROR] BDSK-SCHEMA-001  artifact <id>: duplicate artifact ID
  [ERROR] BDSK-REF-001     artifact <id>: references missing artifact <target>
  ...

Result: CONFORMANT / NON-CONFORMANT
```

## Rules

- This is a lightweight pre-validator, not the full 8-phase validator from validator-spec.md
- It checks V1 (discovery), V2 (schema), V3 (trace), and partial V4 (referential integrity)
- It does NOT check authority (V5), execution conformance (V6), or acceptance (V8)
- Report ALL errors found, don't stop at the first one
