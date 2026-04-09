---
name: plan-execution
description: |
  Generate a BDSK execution_plan from approved behavior specs and assumptions.
  Defines scope boundaries, allowed operations, and required outputs.
  Activates scope enforcement hooks. Use before implementing any feature.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
---

# /plan-execution

Generate an execution plan from approved specs.

## Process

1. **Scan approved artifacts.** Read all files in `artifacts/behaviors/` and `artifacts/assumptions/` that have `status: approved` or `status: accepted`.

2. **If no approved artifacts found**, warn the user: "No approved behavior specs found. Use /specify first, then approve the artifact by changing status to approved."

3. **Determine scope.** Based on the approved specs, determine:
   - in_scope_paths: which files/directories may be created or modified
   - out_of_scope_paths: which files/directories must NOT be touched
   - allowed_operations: what the AI may do (create files, modify files, run tests, etc.)
   - forbidden_operations: what the AI must NOT do

4. **Auto-suggest review gates.** Analyze the approved behavior specs for gate triggers:

   **E2E Testing Gate** — suggest if ANY behavior spec contains UI keywords (page, screen, dialog, modal, form, button, click, navigate, render, display, visible, tooltip, dropdown, sidebar, panel, toast, notification, browser, DOM, CSS, responsive, viewport, component, React, Vue, Angular, Svelte, Next.js):
   - Propose a blocking review gate for E2E browser testing using the `/gate` skill template
   - Gate class: `blocking`, subject: `tests`, evaluation method: `human_review`, fail action: `block`
   - Pass condition: "All UI interactions verified by E2E browser tests"

   **Security Gate** — suggest if specs mention: authentication, authorization, password, token, secret, encrypt, PII, HIPAA, GDPR, credentials, session, permission:
   - Gate class: `blocking`, subject: `security`, fail action: `block`

   **Performance Gate** — suggest if specs mention: latency, throughput, response time, cache, concurrent, scale, load, benchmark, optimization:
   - Gate class: `warning`, subject: `other`, fail action: `warn`

   Present gate recommendations during scope review. Include approved gates in `required_inputs.review_gates` and create the gate artifacts via `/gate`.

5. **Ask the user** to confirm or adjust the scope via AskUserQuestion.

6. **Write the artifact:**

```yaml
kind: execution_plan
schema_version: "0.3"
id: EP-<short-slug>-<timestamp>
title: <execution title>
status: draft
owners:
  - <current user>
created_at: <current ISO-8601 timestamp>
updated_at: <current ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <behavior spec id>
      edge: depends_on
  downstream: []
approvals: []
metadata:
  change_type: <new_feature|bugfix|refactor|migration|hardening>
spec:
  objective: <what the AI is supposed to achieve>
  in_scope_paths:
    - <paths that may be modified>
  out_of_scope_paths:
    - <paths that must NOT be modified>
  allowed_operations:
    - create_files
    - modify_files
    - run_tests
  forbidden_operations:
    - modify_spec
    - modify_schemas
    - delete_artifacts
  required_inputs:
    behaviors:
      - <behavior spec ids>
    assumptions:
      - <assumption ids>
    contracts: []
    policies: []
    review_gates: []
  required_outputs:
    - generated_diff
    - verification_artifact
  escalation_conditions:
    - required dependency missing or contradictory
    - behavior spec too ambiguous to implement safely
  completion_criteria:
    - all required outputs emitted
    - all changes within approved scope
```

7. **Write to disk.** Save to `artifacts/execution-plans/<id>.yaml`

8. **Activate scope enforcement.** Write the execution plan ID to `.claude/state/active-executions/<id>.yaml`:

```yaml
execution_plan_id: <id>
activated_at: <ISO-8601 timestamp>
```

9. **Present for review.** The user changes status from `draft` to `approved` to activate.

## Rules

- Every execution plan MUST trace to at least one approved behavior spec
- in_scope_paths and out_of_scope_paths MUST be explicitly defined
- The BDSK specification document (`bdsk_specification_v_0.md`) and JSON schemas (`schemas/*.json`) are ALWAYS in out_of_scope_paths unless the execution plan explicitly governs spec changes
- NEVER put governance output paths in out_of_scope_paths. These are always writable:
  - `artifacts/diffs/` (created by /run Phase 3.5)
  - `artifacts/verifications/` (created by /verify)
  - `artifacts/execution-evals/` (created by /evaluate)
  - `artifacts/acceptance/` (created by /accept)
  - `artifacts/execution-logs/` (created during execution)
  The check-scope.sh hook whitelists these paths, but defense-in-depth means not blocking them in the plan either.
- After approval, the check-scope.sh hook will enforce the boundaries
- When invoked from /run, the composite skill handles user interaction for scope confirmation
- When generating `in_scope_paths`, suggest including common config files that implementations frequently need: `*.config.ts`, `*.config.js`, `*.config.mjs`, `package.json`. The user can remove them during scope review

## Schema Compliance

- **metadata allows exactly 1 field**: `change_type`. Do NOT add `description`, `priority`, `estimated_effort`, or other fields. Schema uses `additionalProperties: false`.
- **completion_criteria items are plain STRINGS**, not objects. Do NOT use `{criterion: "...", metric: "..."}`.
  ```yaml
  # WRONG:
  completion_criteria:
    - criterion: "all tests pass"
      metric: "100% green"
  # RIGHT:
  completion_criteria:
    - "all tests pass with 100% green"
  ```
- **escalation_conditions items are plain STRINGS**.
- **required_outputs items are plain STRINGS**.
- **Trace refs** MUST be `{target_id: <id>, edge: <edge>}` objects, not bare string IDs.
- **Approvals** MUST use `{authority_role: <role>, approver: <user>, approved_at: <ISO-8601>}`. Not `{date, decision}`.
- **Valid trace edges** (10 total): `depends_on`, `derived_from`, `constrains`, `implements`, `proves`, `evaluates`, `produced_by`, `supersedes`, `escalates_to`, `waives`.
- **Valid authority roles** (5 total): `product_authority`, `technical_authority`, `security_authority`, `release_authority`, `qa_authority`.

### Edge-kind rules for execution_plan
- Upstream `depends_on` → behavior_spec, assumption_record, contract_artifact, codegen_policy, review_gate
- No other upstream edges are valid for execution_plan
- Do NOT use `derived_from` or `implements` — those are not valid upstream edges for execution_plan
