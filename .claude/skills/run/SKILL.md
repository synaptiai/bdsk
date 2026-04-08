---
name: run
description: |
  Full BDSK lifecycle in one command. Chains: specify → plan → implement →
  evaluate → verify → validate → accept. Human intervenes only at judgment
  points (spec review, scope review) and on failure. Everything else is
  automatic. Use for any feature or change that should follow BDSK governance.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /run

Execute the full BDSK lifecycle with minimal human intervention.

## Input

The user provides a feature description or a resume flag: `$ARGUMENTS`

- `/run <feature description>` — full lifecycle from specification to acceptance
- `/run --from <phase>` — resume from a specific phase (specify|plan|implement|evaluate|verify|validate|accept)

## Design Principle

**Human approves the WHAT, not the HOW.**

There are exactly 2 mandatory human gates — reviewing the specification and reviewing the scope. Everything downstream proceeds automatically unless it fails. Failure is the escalation trigger, not success.

## Process

### Phase 1: SPECIFY

1. Follow the `/specify` skill process: understand the behavior, generate concrete examples, write the artifact.
2. If assumptions are identified, create them via `/assume` logic.
3. Present the generated specs to the user.

**HUMAN GATE**: Ask the user via AskUserQuestion:
- "Review these behavior specs. Approve to proceed, or describe changes."
- Options: "Approve and continue", "Edit first" (user provides feedback), "Cancel"

4. On approval, run `/approve` logic on all generated artifacts (batch approval with inferred authority).

### Phase 2: PLAN

1. Follow the `/plan-execution` skill process: scan approved artifacts, determine scope.
2. IMPORTANT: Never include these in `out_of_scope_paths`:
   - `artifacts/verifications/`
   - `artifacts/execution-evals/`
   - `artifacts/acceptance/`
   - `artifacts/execution-logs/`
3. Present the scope to the user.

**HUMAN GATE**: Ask the user via AskUserQuestion:
- "Review execution scope. Approve to proceed, or adjust."
- Options: "Approve scope and start", "Adjust scope" (user provides changes), "Cancel"

4. On approval, run `/approve` logic on the plan. Activate scope enforcement.

### Phase 3: IMPLEMENT

1. Execute the implementation within the approved scope.
2. The scope enforcement hook (`check-scope.sh`) enforces boundaries automatically.
3. Code, create files, modify files, run tests — all within `in_scope_paths`.

**NO HUMAN GATE**: The AI works within approved boundaries. The scope hook is the quality gate.

### Phase 4: EVALUATE

1. Follow the `/evaluate` skill process.
2. If no review gates are defined, print "No gates — skipping evaluation" and continue.
3. Create execution_eval artifacts for each gate.
4. If any blocking gate fails: **STOP and escalate**.

**CONDITIONAL GATE**: Only stops if a gate fails. Otherwise proceeds automatically.

### Phase 5: VERIFY

1. Run tests via `bun test` (or detected test runner). Capture output.
2. Follow the `/verify` skill process: create verification_artifact for each behavior spec.
3. If all tests pass: proceed automatically.
4. If any test fails: **STOP and escalate**.

**CONDITIONAL GATE**: Only stops if tests fail. Otherwise proceeds automatically.

### Phase 6: VALIDATE

1. Run the full 8-phase validator: `bun run src/cli.ts . --format text --verbose`
2. Display the output.
3. If conformant (exit 0): proceed automatically.
4. If non-conformant (exit 1): analyze findings.
   - If only warnings and expected findings (e.g., historical plan issues): proceed.
   - If blocking errors related to THIS execution: **STOP and escalate**.

**CONDITIONAL GATE**: Only stops on new blocking errors.

### Phase 7: ACCEPT

1. Follow the `/accept` skill process: compute Algorithm E.
2. If outcome is `accepted`: record the acceptance decision automatically, clean up active execution state. Print "ACCEPTED" and summary.
3. If outcome is `conditionally_accepted`: record with conditions. Print conditions.
4. If outcome is `rejected` or `indeterminate`: **STOP and present findings**.

**CONDITIONAL GATE**: Only stops if not accepted.

## State Tracking

Write phase progress to `.claude/state/active-executions/<plan-id>.yaml`:
```yaml
execution_plan_id: <id>
activated_at: <timestamp>
current_phase: <specify|plan|implement|evaluate|verify|validate|accept>
```

This enables `/run --from <phase>` to resume from where it left off.

## Rules

- The 2 mandatory human gates (spec review, scope review) ALWAYS require user input
- Downstream phases (evaluate, verify, validate, accept) proceed automatically on success
- Any failure escalates to the user with a clear explanation of what failed and why
- Never skip the validate phase — it catches issues that individual skills miss
- If the user says "Cancel" at any gate, stop immediately and clean up:
  - Remove the active execution entry from `.claude/state/active-executions/`
  - Leave generated artifacts as `draft` (they can be reused in a future /run)
  - Log the cancellation reason in the change log
- The /run skill is a thin orchestrator — it calls existing skill logic, not new logic
