---
name: evaluate
description: |
  Evaluate review gates against the generated diff and create execution_eval
  YAML artifacts. Closes BDSK lifecycle phase 5 (Evaluation).
  Satisfies Algorithm E condition 2. Use after implementation, before /accept.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /evaluate

Evaluate review gates and create execution eval artifacts.

## Process

1. **Find the execution plan.** Read `.claude/state/active-executions/*.yaml` to find the active execution plan ID. Read the plan from `artifacts/execution-plans/`.

2. **Collect required gates.** Extract `spec.required_inputs.review_gates` from the plan. If empty, print "No review gates defined. Gate evaluation not required — skipping." and exit.

3. **Read each gate.** For each review gate ID, read the artifact to get:
   - `metadata.gate_class` (blocking, warning, manual-review, escalation)
   - `spec.evaluation_method` (static_check, human_review, diff_analysis, etc.)
   - `spec.pass_condition` (what must be true to pass)

4. **Evaluate each gate.** Based on `evaluation_method`:
   - `diff_analysis`: Check the git diff against the plan's `in_scope_paths` and `out_of_scope_paths`
   - `static_check`: Run available linters/checkers, or analyze code for the pass_condition
   - `spec_coverage`: Check that all behavior specs have traced implementations
   - `human_review`: Ask the user via AskUserQuestion to provide their assessment
   - `contract_check`: Verify contract artifacts have matching implementations
   - `other`: Ask the user to evaluate manually

5. **Find the diff artifact.** Look for a `generated_diff` artifact in `artifacts/diffs/` that traces to the execution plan (check `trace.upstream` for the plan ID). If none exists (e.g., running `/evaluate` standalone without `/run`), use the plan ID as subject_diff and note "No generated_diff artifact found — evaluation based on git diff" in the evidence.

6. **Create execution eval artifacts.** For each gate, write:

```yaml
kind: execution_eval
schema_version: "0.3"
id: EE-<short-slug>-<current ISO-8601 timestamp>
title: "Gate evaluation: <gate title>"
status: completed
owners:
  - <current user>
created_at: <current ISO-8601 timestamp>
updated_at: <current ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <execution_plan_id>
      edge: depends_on
    - target_id: <review_gate_id>
      edge: depends_on
    - target_id: <generated_diff_id>
      edge: evaluates
  downstream: []
approvals: []
metadata:
  eval_type: gate_check
spec:
  subject_diff: <generated_diff_id>
  subject_gate: <review_gate_id>
  result: <pass|warn|fail|escalate>
  findings:
    - <issue description, or empty if pass>
  evidence:
    - <evidence description>
```

7. **Write to disk.** Save each to `artifacts/execution-evals/<id>.yaml`

8. **Report summary:**

```
Gate Evaluation Summary
=======================
Review gates: N total
  pass: N
  warn: N
  fail: N

Results:
  RG-xxx "Gate title" → PASS
  RG-xxx "Gate title" → FAIL (blocking)
```

9. **Warn on blocking failures.** If any gate with `gate_class: blocking` has result `fail`, warn: "BDSK-GATE-001: Blocking gate <id> failed. /accept will compute 'rejected' unless a waiver is approved."

## Rules

- If no review gates are defined, exit cleanly (not an error)
- For `human_review` gates, ALWAYS ask the user — never auto-pass
- For `blocking` gates that fail, explicitly warn about acceptance impact
- Never modify the review gate artifacts — only read them
- Never create waiver artifacts — that is a separate governance action
