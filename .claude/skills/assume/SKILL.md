---
name: assume
description: |
  Capture an assumption as a structured BDSK assumption_record artifact.
  Use when a decision, belief, or unresolved inference affects implementation.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
  - Bash
---

# /assume

Capture an assumption as a structured record.

## Input

The user provides a statement: `$ARGUMENTS`

## Process

1. **Clarify the assumption.** If the statement is vague, ask for specifics. An assumption must be a concrete claim that could be true or false.

2. **Assess impact.** Ask the user or infer:
   - Impact level: low, medium, high, or critical
   - Area: security, product, architecture, compliance, or other

3. **Write the artifact:**

```yaml
kind: assumption_record
schema_version: "0.3"
id: AR-<short-slug>-<timestamp>
title: <short assumption title>
status: proposed
owners:
  - <current user>
created_at: <current ISO-8601 timestamp>
updated_at: <current ISO-8601 timestamp>
trace:
  upstream: []
  downstream: []
approvals: []
metadata:
  impact_level: <low|medium|high|critical>
  area: <security|product|architecture|compliance|other>
spec:
  statement: <the assumption itself, precise and falsifiable>
  rationale: <why this assumption exists>
  source_type: <documented|inferred|decision|external-standard|legacy-system>
  source_refs: []
  decision_authority: <role or person who can accept/reject this>
  review_by: <ISO-8601 date, default 30 days from now>
  resolution_rule: <what must happen before execution if unresolved>
```

4. **Write to disk.** Save to `artifacts/assumptions/<id>.yaml`

5. **Present for review.** The user runs `/approve <id>` to accept the assumption.

## Rules

- Assumptions MUST be falsifiable statements, not vague beliefs
- Impact level MUST reflect the consequence of the assumption being wrong
- review_by defaults to 30 days from creation unless the user specifies otherwise
- resolution_rule MUST describe what blocks execution if this assumption is unresolved
