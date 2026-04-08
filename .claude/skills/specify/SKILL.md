---
name: specify
description: |
  Generate a BDSK behavior_spec artifact from a feature description.
  Produces concrete given/when/then examples and writes to artifacts/behaviors/.
  Use when starting work on any new feature or behavior change.
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - Bash
---

# /specify

Generate a behavior_spec artifact for a feature or behavior.

## Input

The user provides a natural language description of the feature: `$ARGUMENTS`

## Process

1. **Understand the behavior.** Read relevant existing code and artifacts to understand context. Ask clarifying questions if the description is ambiguous.

2. **Generate concrete examples.** For each behavior, produce at least 2 given/when/then examples with explicit values, not placeholders. Every example must use real data.

3. **Identify assumptions.** If the behavior depends on decisions or beliefs not established in existing artifacts, note them. Offer to create assumption_records for each via `/assume`.

4. **Write the artifact.** Generate a YAML file following this exact structure:

```yaml
kind: behavior_spec
schema_version: "0.3"
id: BS-<short-slug>-<timestamp>
title: <human readable title>
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
  tags: []
spec:
  actor: <primary actor or system>
  goal: <behavior goal>
  preconditions:
    - <explicit state required before this behavior>
  trigger:
    type: <event|request|command|schedule>
    action: <explicit action>
  examples:
    - id: EX-<slug>-01
      given:
        - <concrete precondition with real values>
      when:
        - <concrete action with real values>
      then:
        - <concrete observable outcome with real values>
  observable_outcomes:
    - <what can be verified>
  linked_assumptions: []
  linked_contracts: []
  non_goals:
    - <what this behavior explicitly does NOT do>
```

5. **Write to disk.** Save to `artifacts/behaviors/<id>.yaml`

6. **Present for review.** Show the artifact to the user. Explain that changing `status: draft` to `status: approved` (and adding an approvals entry) is how they approve it.

## Rules

- Every example MUST use concrete values, not placeholders
- At least 2 examples per behavior spec
- Non-goals are mandatory: explicitly state what this behavior does NOT cover
- If upstream artifacts exist (assumptions, contracts), link them in trace.upstream
- Generate a unique ID using the pattern BS-<feature-slug>-<YYYYMMDD-HHMMSS>
