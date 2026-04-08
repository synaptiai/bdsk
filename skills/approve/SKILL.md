---
name: approve
description: |
  Approve one or more BDSK artifacts in a single command. Handles the YAML
  surgery of changing status, adding approvals entries, and updating timestamps.
  Supports single, batch, and cascading approval. Use instead of manually
  editing artifact YAML files.
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# /approve

Approve BDSK artifacts in one command.

## Input

The user provides artifact IDs, patterns, or flags: `$ARGUMENTS`

## Modes

### Single: `/approve BS-login-001`
Approve one artifact by exact ID.

### Batch: `/approve --all-draft behaviors`
Approve all artifacts of a given kind that are in draft/proposed status.
Valid kinds: behaviors, assumptions, plans, gates, policies, contracts.

### Cascading: `/approve --plan EP-feature-001`
Approve an execution plan AND all its upstream dependencies (behavior specs, assumptions) that are still draft/proposed. This is the most common workflow — approve everything needed to start execution.

### Override: `/approve --as product_authority BS-login-001`
Override the inferred authority role.

## Process

1. **Resolve targets.** Based on the input mode:
   - Single: Glob `artifacts/**/*.yaml`, find the file containing `id: <target>`
   - Batch: Glob `artifacts/<kind>/*.yaml`, filter by `status: draft` or `status: proposed`
   - Cascading: Read the plan's `trace.upstream`, collect all target IDs, resolve each

2. **Preview.** Show the user what will be approved:
   ```
   Will approve 5 artifacts:
     BS-login-001 (behavior_spec, draft → approved)
     BS-signup-002 (behavior_spec, draft → approved)
     AR-session-001 (assumption_record, proposed → accepted)
     AR-jwt-001 (assumption_record, proposed → accepted)
     EP-feature-001 (execution_plan, draft → approved)
   ```
   If more than 1 artifact, ask for confirmation via AskUserQuestion.

3. **Apply.** For each artifact:
   a. Determine the new status:
      - `assumption_record`: `proposed` → `accepted`
      - All others: `draft` → `approved`
   b. Infer the authority role (unless `--as` overrides):
      - `behavior_spec` → `technical_authority`
      - `assumption_record` (area: product) → `product_authority`
      - `assumption_record` (area: architecture) → `technical_authority`
      - `assumption_record` (area: security) → `security_authority`
      - `execution_plan` → `technical_authority`
      - `codegen_policy` → `technical_authority`
      - `review_gate` → `technical_authority`
      - `contract_artifact` → `technical_authority`
   c. Edit the file:
      - Change `status: draft` (or `proposed`) to the new status
      - Replace `approvals: []` with an approvals entry containing:
        - `authority_role`: inferred or overridden role
        - `approver`: current user (from `owners[0]` in the artifact)
        - `approved_at`: current ISO-8601 timestamp
      - Update `updated_at` to current timestamp

4. **Report.** Print summary of what was approved.

5. **If cascading plan approval**, also activate scope enforcement:
   - Write the execution plan ID to `.claude/state/active-executions/<plan-id>.yaml`

## Rules

- Never approve an artifact that has errors (run a basic validation check first)
- For cascading approval, always show the full list before proceeding
- If a single artifact is already approved/accepted, print "Already approved: <id>" and exit
- If batch/cascading and some artifacts are already approved, show which ones will be skipped
- The `approvals: []` → structured entry replacement must handle both empty array and missing field
- When approving behavior_specs that have `status: draft` appearing in examples too, use enough context to only match the envelope status field
