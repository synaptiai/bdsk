---
name: gate
description: |
  Create a BDSK review_gate artifact. Defines a checkpoint that controls
  whether generated output may proceed toward acceptance.
  Use when defining quality, security, or scope gates for execution plans.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
  - Bash
---

# /gate

Create a review gate artifact.

## Input

The user provides a description of what the gate checks: `$ARGUMENTS`

## Process

1. **Understand the gate purpose.** Determine the gate_class and subject from the user's description. Ask clarifying questions if ambiguous.

2. **Determine gate parameters:**
   - `gate_class`: `blocking` (prevents acceptance), `warning` (allows conditional), `manual-review` (requires human sign-off), `escalation` (requires authority decision)
   - `subject`: `scope`, `dependencies`, `contracts`, `tests`, `security`, `architecture`, `other`
   - `evaluation_method`: `static_check`, `human_review`, `diff_analysis`, `contract_check`, `spec_coverage`, `other`
   - `fail_action`: `block`, `warn`, `require_manual_review`, `escalate`

3. **Write the artifact:**

```yaml
kind: review_gate
schema_version: "0.3"
id: RG-<short-slug>-<YYYYMMDD-HHMMSS>
title: <human readable gate title>
status: draft
owners:
  - <current user>
created_at: <current ISO-8601 timestamp>
updated_at: <current ISO-8601 timestamp>
trace:
  upstream: []
  downstream: []
approvals: []
metadata:
  gate_class: <blocking|warning|manual-review|escalation>
  subject: <scope|dependencies|contracts|tests|security|architecture|other>
spec:
  description: <what this gate checks>
  applies_when:
    - <condition when this gate applies>
  evaluation_method: <static_check|human_review|diff_analysis|contract_check|spec_coverage|other>
  pass_condition:
    - <condition that must be true to pass>
  fail_action: <block|warn|require_manual_review|escalate>
  evidence_required:
    - <what evidence must be provided>
```

4. **Write to disk.** Save to `artifacts/gates/<id>.yaml`

5. **Present for review.** Show the artifact to the user. Explain that running `/approve <id>` is how they approve it.

## Rules

- gate_class determines severity: `blocking` prevents acceptance, `warning` allows conditional acceptance
- subject determines authority requirements: `security` gates require `security_authority` for approval
- pass_condition MUST be an array of strings (not a single string)
- applies_when MUST be an array of strings
- evidence_required MUST be an array of strings
- If linking to behavior specs or policies, add them as upstream trace refs

## Schema Compliance

- **metadata requires exactly 2 fields**: `gate_class` and `subject`. No additional fields. Schema uses `additionalProperties: false`.
- **spec requires exactly 6 fields**: `description`, `applies_when`, `evaluation_method`, `pass_condition`, `fail_action`, `evidence_required`. No additional fields. Schema uses `additionalProperties: false`.
- **Trace refs** MUST be `{target_id: <id>, edge: <edge>}` objects, not bare string IDs.
- **Approvals** MUST use `{authority_role: <role>, approver: <user>, approved_at: <ISO-8601>}`. Not `{date, decision}`.
- **Valid trace edges** (10 total): `depends_on`, `derived_from`, `constrains`, `implements`, `proves`, `evaluates`, `produced_by`, `supersedes`, `escalates_to`, `waives`.
- **Valid authority roles** (5 total): `product_authority`, `technical_authority`, `security_authority`, `release_authority`, `qa_authority`.

### Edge-kind rules for review_gate
- Upstream `depends_on` → codegen_policy, behavior_spec
- Do NOT use `constrains` upstream to behavior_spec — use `depends_on`
- Downstream `evaluates` → execution_eval
