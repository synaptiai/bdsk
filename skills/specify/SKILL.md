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

4. **Integration Depth Protocol.** If the behavior involves a third-party SDK, external API, or any dependency outside this repository:

   a. **Identify integration points.** List every external call the behavior requires.

   b. **Demand specifics via AskUserQuestion:**
      - "This behavior involves [SDK/API name]. To prevent integration bugs, I need precise details:"
        - Exact method signatures (e.g., `client.messages.create({model, max_tokens, messages})`)
        - Exact state/status enum values (e.g., `'approval-requested'`, not `'approval-required'`)
        - Exact response shapes (field names, types, nesting)
        - Error types (exact class names or error codes)

   c. **If the user cannot provide specifics:** Create an `assumption_record` with `impact_level: high`, `area: architecture`, `source_type: undocumented`. Add to the behavior spec's `non_goals`: "Exact API contract for [SDK] deferred — see assumption [ID]".

   d. **If the user CAN provide specifics:** Recommend creating a `contract_artifact` to formalize the API boundary. Link it in the behavior spec's `trace.upstream` with `edge: depends_on`.

5. **Write the artifact.** Generate a YAML file following this exact structure:

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

6. **Write to disk.** Save to `artifacts/behaviors/<id>.yaml`

7. **Present for review.** Show the artifact to the user. Explain that running `/approve <id>` is how they approve it.

## Rules

- Every example MUST use concrete values, not placeholders
- At least 2 examples per behavior spec
- Non-goals are mandatory: explicitly state what this behavior does NOT cover
- If upstream artifacts exist (assumptions, contracts), link them in trace.upstream
- Generate a unique ID using the pattern BS-<feature-slug>-<YYYYMMDD-HHMMSS>
- **YAML safety**: All string values in `given`, `when`, `then`, and `and` arrays MUST be quoted with double quotes. Strings containing colons (`:`), curly braces (`{}`), square brackets (`[]`), or other YAML-special characters will break parsing if left unquoted. Always quote to be safe:
  ```yaml
  # WRONG — bare colon breaks YAML:
  - The section contains 1 item: Michael Reed
  # RIGHT — quoted string is safe:
  - "The section contains 1 item: Michael Reed"
  
  # WRONG — curly braces interpreted as YAML mapping:
  - The tool returns { success: false }
  # RIGHT:
  - "The tool returns { success: false }"
  ```

## Schema Compliance

- **given/when/then/and items are plain STRINGS, not objects.** Do NOT generate `{outcome: "...", assertion: "..."}` or `{action: "...", context: "..."}`. Each item is a single quoted string.
  ```yaml
  # WRONG — object instead of string:
  then:
    - outcome: "artifact is created"
      assertion: "file exists"
  # RIGHT — plain string:
  then:
    - "artifact is created and file exists"
  ```
- **Trace refs** MUST be `{target_id: <id>, edge: <edge>}` objects, not bare string IDs.
  ```yaml
  # WRONG:
  upstream:
    - BS-login-001
  # RIGHT:
  upstream:
    - target_id: BS-login-001
      edge: derived_from
  ```
- **Approvals** MUST use `{authority_role: <role>, approver: <user>, approved_at: <ISO-8601>}`. Not `{date, decision}` or `{approver, date}`.
- **Valid trace edges** (10 total): `depends_on`, `derived_from`, `constrains`, `implements`, `proves`, `evaluates`, `produced_by`, `supersedes`, `escalates_to`, `waives`.
- **Valid authority roles** (5 total): `product_authority`, `technical_authority`, `security_authority`, `release_authority`, `qa_authority`.
- **No additional fields** in metadata (only `tags` and optionally `domain`) or spec beyond the template. Schema uses `additionalProperties: false`.

### Edge-kind rules for behavior_spec
- Upstream `derived_from` → behavior_spec, assumption_record
- Upstream `depends_on` → assumption_record, contract_artifact
- Do NOT use `depends_on` upstream to another behavior_spec (use `derived_from`)
- Do NOT add downstream `derived_from` edges (not valid in downstream direction for behavior_spec)
