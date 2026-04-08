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

5. **If accepted or conditionally_accepted, write the artifact:**

```yaml
kind: acceptance_decision
schema_version: "0.3"
id: AD-<short-slug>-<timestamp>
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
  subject_diffs: []
  decision_summary: <summary of what was accepted>
  reasons:
    - <why this decision was made>
  conditions: []
  residual_risks: []
  approvers:
    - <current user>
```

6. **Clean up active execution state.** Remove the execution plan from `.claude/state/active-executions/`.

7. **Write to disk.** Save to `artifacts/acceptance/<id>.yaml`

## Rules

- Never record `accepted` if any blocking condition fails
- Always present findings to the user before writing the artifact
- The user's explicit approval (responding to AskUserQuestion) is the authority act
- If `conditionally_accepted`, conditions array MUST be non-empty
