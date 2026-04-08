---
name: accept
description: |
  Compute acceptance eligibility per BDSK Algorithm E.
  Checks verification coverage, execution evals, gate status,
  and authority. Generates an acceptance_decision artifact.
  Use after /validate passes.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
---

# /accept

Compute acceptance eligibility and generate an acceptance_decision.

## Process

1. **Run /validate first.** If validation has not been run, tell the user to run `/validate` first.

2. **Check Algorithm E conditions.** For the active execution plan, verify:

   a. Required verification artifacts exist and pass (`execution_result: pass`)
   b. Required execution evals exist (if any review gates are defined)
   c. No unwaived blocking gate failures remain
   d. No unresolved manual-review or escalation gates remain
   e. No unresolved stop-condition breaches remain
   f. Acceptance is approved by required authority

3. **Compute outcome:**
   - If all 6 conditions pass: `accepted`
   - If blocking conditions pass but non-blocking warnings remain: `conditionally_accepted`
   - If any required dependency is unresolvable: `indeterminate`
   - Otherwise: `rejected`

4. **Present findings.** Show the user which conditions passed and which failed.

5. **Write the acceptance decision artifact.** Always record the decision, regardless of outcome:

```yaml
kind: acceptance_decision
schema_version: "0.3"
id: AD-<short-slug>-<current ISO-8601 timestamp>
title: Acceptance decision for <execution plan title>
status: recorded
owners:
  - <current user>
created_at: <current ISO-8601 timestamp>
updated_at: <current ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <execution plan id>
      edge: depends_on
  downstream: []
approvals:
  - authority_role: release_authority
    approver: <current user>
    approved_at: <current ISO-8601 timestamp>
metadata:
  outcome: <accepted|conditionally_accepted|rejected|indeterminate>
spec:
  subject_diffs:
    - <generated_diff_id if it exists>
  decision_summary: <summary of what was decided and why>
  reasons:
    - <why this decision was made>
  conditions: []
  residual_risks: []
  approvers:
    - <current user>
```

6. **Clean up active execution state.** If outcome is `accepted` or `conditionally_accepted`, remove the execution plan from `.claude/state/active-executions/`. If `rejected`, leave the active execution in place so the user can fix issues and re-run.

7. **Write to disk.** Save to `artifacts/acceptance/<id>.yaml`

## Rules

- Never record `accepted` if any blocking condition fails
- When outcome is `accepted` and all 6 conditions pass: record automatically without asking
- When outcome is `conditionally_accepted`, `rejected`, or `indeterminate`: present findings to user and ask for their decision
- The user's explicit approval is required only when the outcome is not clean `accepted`
- If `conditionally_accepted`, conditions array MUST be non-empty
- When invoked from /run, follows the same auto-accept-on-success principle
