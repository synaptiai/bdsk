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

4. **Ask the user** to confirm or adjust the scope via AskUserQuestion.

5. **Write the artifact:**

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

6. **Write to disk.** Save to `artifacts/execution-plans/<id>.yaml`

7. **Activate scope enforcement.** Write the execution plan ID to `.claude/state/active-executions/<id>.yaml`:

```yaml
execution_plan_id: <id>
activated_at: <ISO-8601 timestamp>
```

8. **Present for review.** The user changes status from `draft` to `approved` to activate.

## Rules

- Every execution plan MUST trace to at least one approved behavior spec
- in_scope_paths and out_of_scope_paths MUST be explicitly defined
- The spec and schemas are ALWAYS in out_of_scope_paths unless the execution plan explicitly governs spec changes
- NEVER put governance output paths in out_of_scope_paths. These are always writable:
  - `artifacts/verifications/` (created by /verify)
  - `artifacts/execution-evals/` (created by /evaluate)
  - `artifacts/acceptance/` (created by /accept)
  - `artifacts/execution-logs/` (created during execution)
  The check-scope.sh hook whitelists these paths, but defense-in-depth means not blocking them in the plan either.
- After approval, the check-scope.sh hook will enforce the boundaries
- When invoked from /run, the composite skill handles user interaction for scope confirmation
