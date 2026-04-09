---
name: rescope
description: |
  Amend an active execution plan's scope boundaries. Edits in_scope_paths
  and out_of_scope_paths of the current plan with human approval.
  Use when implementation discovers files outside the approved scope.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash
---

# /rescope

Amend the scope of an active execution plan.

## Input

The user provides paths to add to scope or a description of why scope needs to change: `$ARGUMENTS`

## Process

1. **Find the active execution plan.** Read `.claude/state/active-executions/*.yaml` to find the current plan ID. Then read the corresponding artifact from `artifacts/execution-plans/`.

2. **If no active execution plan found**, warn: "No active execution plan. Use `/plan-execution` to create one first."

3. **Determine the amendment.** Based on user input:
   - Paths to ADD to `in_scope_paths`
   - Paths to REMOVE from `out_of_scope_paths` (if they were explicitly blocked)
   - Justification for the scope change

4. **Present the amendment for approval.** Ask the user via AskUserQuestion:
   - "Scope amendment for [plan ID]:"
   - "Add to in_scope_paths: [paths]"
   - "Remove from out_of_scope_paths: [paths, if any]"
   - "Reason: [justification]"
   - Options: "Approve amendment", "Modify" (user provides changes), "Cancel"

5. **Apply the amendment.** On approval:
   a. Edit the execution plan artifact:
      - Add new paths to `spec.in_scope_paths`
      - Remove paths from `spec.out_of_scope_paths` if requested
      - Update `updated_at` timestamp
   b. Create an `assumption_record` documenting the scope change:
      ```yaml
      kind: assumption_record
      schema_version: "0.3"
      id: AR-rescope-<YYYYMMDD-HHMMSS>
      title: "Scope amendment: [brief description]"
      status: proposed
      owners:
        - <current user>
      created_at: <ISO-8601 timestamp>
      updated_at: <ISO-8601 timestamp>
      trace:
        upstream:
          - target_id: <execution_plan_id>
            edge: derived_from
        downstream: []
      approvals: []
      metadata:
        impact_level: medium
        area: architecture
      spec:
        statement: "Execution scope expanded to include [paths] because [reason]"
        rationale: "Implementation discovered a dependency on files outside the original scope"
        source_type: decision
        source_refs: []
        decision_authority: <current user>
        review_by: <30 days from now, ISO-8601>
        resolution_rule: "Verify that the scope expansion was necessary and did not introduce unintended changes"
      ```
   c. Save the assumption to `artifacts/assumptions/<id>.yaml`

6. **The scope hook picks up changes immediately** — no restart needed. The `check-scope.sh` hook re-reads the plan on every tool call.

## Rules

- The execution plan MUST be in `approved` status to amend
- The `artifacts/execution-plans/` path is in the governance whitelist, so the scope hook allows edits
- Every scope amendment creates an assumption_record for audit trail
- The amendment is a targeted edit, not a plan replacement — the plan ID stays the same
- If the user cancels, do nothing

## Schema Compliance

- **assumption_record** metadata requires `impact_level` and `area`
- Status is `proposed` (transitions to `accepted` via `/approve`)
- Trace uses `derived_from` edge to the execution_plan
- Approvals use `{authority_role, approver, approved_at}` format
- Valid authority roles: `product_authority`, `technical_authority`, `security_authority`, `release_authority`, `qa_authority`
