---
name: verify
description: |
  Run tests and create verification_artifact YAML for each behavior spec
  in the execution plan. Closes BDSK lifecycle phase 6 (Verification).
  Satisfies Algorithm E condition 1. Use after implementation, before /accept.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# /verify

Run tests and create verification artifacts.

## Process

1. **Find the execution plan.** Read `.claude/state/active-executions/*.yaml` to find the active execution plan ID. Read the plan from `artifacts/execution-plans/`. If no active plan, check the most recent execution plan artifact.

2. **Collect required behaviors.** Extract `spec.required_inputs.behaviors` from the plan. Read each behavior spec to get its title and examples.

3. **Discover tests.** For each behavior spec, search for associated tests:
   - Glob `test/**/*.test.ts`, `test/**/*.test.js`, `test/**/*.spec.ts`
   - If the project uses `bun test`, `npm test`, or `vitest`, detect the test runner
   - If no tests are found for a behavior spec, ask the user via AskUserQuestion:
     - Enter test path manually
     - Skip (mark as not_run)

4. **Run tests.** Execute the test runner (e.g., `bun test`) and capture stdout/stderr. Save test output to a file for evidence.

5. **Create verification artifacts.** For each behavior spec, write a YAML file:

```yaml
kind: verification_artifact
schema_version: "0.3"
id: VA-<short-slug>-<current ISO-8601 timestamp>
title: "Verification for <behavior spec title>"
status: draft
owners:
  - <current user>
created_at: <current ISO-8601 timestamp>
updated_at: <current ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <behavior_spec_id>
      edge: proves
  downstream: []
approvals: []
metadata:
  verification_type: <acceptance_test|unit_test|integration_test>
spec:
  location: <test file path>
  proves:
    - <behavior_spec_id>
  execution_result: <pass|fail|not_run|waived>
  evidence_refs:
    - <path to test output file>
```

6. **Write to disk.** Save each artifact to `artifacts/verifications/<id>.yaml`

7. **Report summary.** Print coverage summary:

```
Verification Summary
====================
Behavior specs: N total
  pass:    N
  fail:    N
  not_run: N

Artifacts created:
  VA-xxx → BS-yyy (pass)
  VA-xxx → BS-yyy (fail)
```

## Rules

- Run tests ONCE and map results to all behavior specs (don't re-run per spec)
- If ALL tests pass, every behavior spec gets `execution_result: pass`
- If ANY test fails, ask the user which behavior specs are affected by the failures
- Always capture test output to a file for evidence_refs
- Never modify test code — only run existing tests
- verification_type should match the test type: `integration_test` for integration/, `unit_test` for unit/, `acceptance_test` for e2e/
