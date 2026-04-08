# BDSK specification v0.3

## status

Draft

## purpose

BDSK defines a specification-first method for AI-assisted software development. It uses behavior-driven specifications, explicit assumptions, concrete examples, and execution-phase governance to reduce ambiguity before code generation and to constrain how AI agents produce code.

BDSK is not a runtime architecture, agent framework, or production observability platform. It is a development governance and specification system for the phase where humans and AI collaborate to design and generate software.

## design goals

BDSK exists to solve a specific class of problems in AI-assisted development:

1. AI generates plausible but incorrect implementations.
2. AI invents APIs, dependencies, or behavior not grounded in the specification.
3. Vague requirements cause AI to make hidden assumptions.
4. Test suites are added too late, after incorrect design choices are already embedded.
5. Important uncertainties are lost inside prompts, chat history, or code comments.
6. Human intent is not translated into a form that reliably constrains code generation.
7. Teams lack a formal way to inspect whether the AI execution process itself stayed within approved scope and policy.

## non-goals

BDSK does not define:

- a production runtime architecture
- a specific programming language or framework
- a specific testing library
- an orchestration system for deployed agents
- application observability, telemetry, or runtime monitoring standards

BDSK may integrate with such systems, but they are outside this specification.

## core thesis

Traditional BDD improves shared understanding between humans.

BDSK extends that idea for AI-assisted development by making specifications concrete enough to govern code generation itself.

In BDSK, specifications are not only communication artifacts. They are execution constraints for AI-assisted implementation.

## terminology

### behavior
An externally observable outcome of a system, expressed from the perspective of users, other systems, or defined interfaces.

### specification
A structured description of intended behavior, examples, rules, assumptions, and constraints.

### execution phase
The phase in which AI generates, edits, or refactors code from an approved BDSK specification.

### artifact
A durable file or structured record used by BDSK to define, constrain, review, or verify intended behavior and generated code.

### assumption
A decision, belief, or unresolved inference that affects implementation but is not directly guaranteed by an authoritative source or prior approved artifact.

### grounding
The act of tying a claim, dependency, interface, behavior, or implementation choice to an approved source such as documentation, standards, existing code, or an accepted decision artifact.

### governance
The rules and gates that control what AI may generate during the execution phase and how that generated output is reviewed and accepted.

### concrete example
A specification example that uses explicit values, states, inputs, and outputs rather than placeholders or abstractions.

### observable outcome
A result that can be verified through a test, assertion, contract check, file diff, or other explicit inspection.

### verification artifact
An artifact whose purpose is to prove that generated code satisfies a behavior, contract, or accepted rule.

### execution-phase eval
An artifact or procedure whose purpose is to assess whether the AI generation process itself stayed within approved scope, policy, and decision boundaries.

### traceability
The ability to connect one artifact or output to the artifacts, rules, or evidence that justify it.

### generated diff
The set of code or file changes produced during execution.

### execution contract
The formal definition of what the AI agent must receive, what it may do, what it must emit, and when it must stop and escalate.

### owner
The role or person responsible for maintaining or curating an artifact.

### authority
A role empowered to approve, reject, waive, escalate, or accept specific classes of artifacts or decisions.

### approver
A concrete authority participant in a specific decision.

## normative language

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY in this document are to be interpreted as requirement levels.

## principles

### 1. concrete example primacy
Specifications MUST prefer explicit examples over abstract descriptions.

### 2. behavior before implementation
Specifications MUST describe intended behavior before AI generates implementation code.

### 3. explicit assumptions
Any material assumption that affects implementation MUST be captured as a first-class artifact or structured record. Assumptions MUST NOT remain implicit in prompts or buried only in generated code comments.

### 4. grounding before generation
AI MUST NOT introduce external interfaces, library usage, or behavior claims unless they are grounded in approved artifacts or explicitly marked for review.

### 5. observable verification
Specified behavior MUST be verifiable through explicit checks.

### 6. boundary discipline
AI MUST stay within the boundaries defined by the approved specification, allowed dependencies, architectural constraints, and approved contracts.

### 7. human approval at ambiguity boundaries
When uncertainty materially affects correctness, security, compliance, architecture, or product behavior, AI MUST stop and surface the issue for human decision rather than silently choosing.

### 8. traceability over intuition
Every material generated change SHOULD be traceable to one or more approved inputs, constraints, or decisions.

## canonical artifact envelope

All structured BDSK artifacts SHOULD conform to the following canonical envelope.

```yaml
kind: <artifact kind>
schema_version: "0.3"
id: <globally unique artifact id>
title: <human readable title>
status: <artifact status>
owners:
  - <role or person>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream: []
  downstream: []
metadata: {}
spec: {}
```

### canonical envelope fields

- `kind`: REQUIRED.
- `schema_version`: REQUIRED.
- `id`: REQUIRED.
- `title`: REQUIRED.
- `status`: REQUIRED.
- `owners`: REQUIRED.
- `created_at`: REQUIRED.
- `updated_at`: REQUIRED.
- `trace`: REQUIRED.
- `metadata`: OPTIONAL.
- `spec`: REQUIRED.

### common artifact statuses

Unless otherwise constrained by the artifact type, the following statuses MAY be used:

- draft
- proposed
- approved
- superseded
- archived
- rejected

## formal trace model

BDSK uses a single normalized trace representation for all structured artifacts.

### normalized trace object

```yaml
trace:
  upstream:
    - target_id: <artifact id>
      edge: <canonical edge type>
  downstream:
    - target_id: <artifact id>
      edge: <canonical edge type>
```

All structured artifacts MUST use this representation.

### canonical trace edge vocabulary

| edge type | meaning |
|---|---|
| `depends_on` | the source artifact requires the target artifact to be valid, available, or approved |
| `derived_from` | the source artifact was created from the target artifact |
| `constrains` | the target artifact limits what the source artifact may define or do |
| `implements` | the source artifact implements the target behavior or contract |
| `proves` | the source artifact provides evidence for the target behavior or contract |
| `evaluates` | the source artifact assesses whether the target artifact or output conforms |
| `produced_by` | the source artifact was produced under the authority of the target execution artifact |
| `supersedes` | the source artifact replaces the target artifact |
| `escalates_to` | the source artifact requires decision or review by the target authority or gate |
| `waives` | the source artifact explicitly waives the target rule or gate |

No other edge types are valid in v0.3.

### trace normalization rules

#### TR-1
Every structured artifact MUST include both `upstream` and `downstream` arrays, even if one or both are empty.

#### TR-2
Each trace reference MUST include exactly two fields: `target_id` and `edge`.

#### TR-3
If a relation can be expressed using a canonical edge type, implementations MUST use that canonical edge type rather than a local synonym.

#### TR-4
The edge type `evaluated_by` is not valid in v0.3.

#### TR-5
Trace relations SHOULD be directionally meaningful. The source artifact is always the artifact that contains the trace object.

## artifact types

### artifact type: behavior spec

Purpose: define observable expected behavior in a form that can govern AI implementation and verification.

```yaml
kind: behavior_spec
schema_version: "0.3"
id: <behavior id>
title: <behavior title>
status: <draft|approved|superseded|archived>
owners:
  - <role or person>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <discovery artifact ids>
      edge: derived_from
    - target_id: <assumption ids>
      edge: depends_on
    - target_id: <contract ids>
      edge: depends_on
  downstream:
    - target_id: <verification ids>
      edge: proves
    - target_id: <execution plan ids>
      edge: constrains
metadata:
  tags: []
  domain: <optional>
spec:
  actor: <primary actor or system>
  goal: <behavior goal>
  preconditions:
    - <explicit state>
  trigger:
    type: <event|request|command|schedule>
    action: <explicit action>
  examples:
    - id: <example id>
      given: []
      when: []
      then: []
      and: []
  observable_outcomes: []
  linked_assumptions: []
  linked_contracts: []
  non_goals: []
```

### artifact type: assumption record

```yaml
kind: assumption_record
schema_version: "0.3"
id: <assumption id>
title: <short assumption title>
status: <proposed|accepted|rejected|superseded|expired|needs-review>
owners:
  - <decision authority>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <source artifact ids>
      edge: derived_from
  downstream:
    - target_id: <behavior ids>
      edge: constrains
    - target_id: <generated diff ids>
      edge: constrains
metadata:
  impact_level: <low|medium|high|critical>
  area: <security|product|architecture|compliance|other>
spec:
  statement: <the assumption itself>
  rationale: <why it exists>
  source_type: <documented|inferred|decision|external-standard|legacy-system>
  source_refs: []
  decision_authority: <role or person>
  review_by: <ISO-8601 date or timestamp>
  resolution_rule: <what must happen before execution if unresolved>
```

### artifact type: contract artifact

```yaml
kind: contract_artifact
schema_version: "0.3"
id: <contract id>
title: <contract title>
status: <draft|approved|superseded|archived>
owners:
  - <role or person>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream: []
  downstream:
    - target_id: <behavior ids>
      edge: constrains
    - target_id: <verification ids>
      edge: proves
metadata:
  contract_type: <openapi|json-schema|event-schema|db-schema>
spec:
  location: <file path or canonical ref>
  governed_boundary: <what this contract defines>
```

### artifact type: codegen policy

```yaml
kind: codegen_policy
schema_version: "0.3"
id: <policy id>
title: <policy title>
status: <draft|approved|superseded|archived>
owners:
  - <role or person>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <architecture docs or security rules>
      edge: derived_from
  downstream:
    - target_id: <execution plan ids>
      edge: constrains
    - target_id: <review gate ids>
      edge: constrains
metadata:
  scope: <repo-wide|domain-specific|path-specific>
spec:
  applies_to_paths: []
  approved_dependencies: []
  forbidden_dependencies: []
  approved_patterns: []
  forbidden_patterns: []
  file_rules:
    manual_review_required: []
    never_modify: []
  required_generation_behaviors: []
  stop_conditions: []
```

### artifact type: review gate

```yaml
kind: review_gate
schema_version: "0.3"
id: <gate id>
title: <gate title>
status: <draft|approved|retired>
owners:
  - <role or person>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <policy ids>
      edge: depends_on
    - target_id: <behavior ids>
      edge: depends_on
  downstream:
    - target_id: <execution eval ids>
      edge: evaluates
metadata:
  gate_class: <blocking|warning|manual-review|escalation>
  subject: <scope|dependencies|contracts|tests|security|architecture|other>
spec:
  description: <what this gate checks>
  applies_when: []
  evaluation_method: <static_check|human_review|diff_analysis|contract_check|spec_coverage|other>
  pass_condition: []
  fail_action: <block|warn|require_manual_review|escalate>
  evidence_required: []
```

### artifact type: execution plan

```yaml
kind: execution_plan
schema_version: "0.3"
id: <execution plan id>
title: <execution title>
status: <draft|approved|completed|aborted>
owners:
  - <role or person>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <behavior ids>
      edge: depends_on
    - target_id: <assumption ids>
      edge: depends_on
    - target_id: <contract ids>
      edge: depends_on
    - target_id: <policy ids>
      edge: depends_on
    - target_id: <gate ids>
      edge: depends_on
  downstream:
    - target_id: <generated diff ids>
      edge: produced_by
    - target_id: <execution eval ids>
      edge: evaluates
    - target_id: <execution log ids>
      edge: evaluates
metadata:
  change_type: <new_feature|bugfix|refactor|migration|hardening>
spec:
  objective: <what the AI is supposed to achieve>
  in_scope_paths: []
  out_of_scope_paths: []
  allowed_operations: []
  forbidden_operations: []
  required_inputs:
    behaviors: []
    assumptions: []
    contracts: []
    policies: []
    review_gates: []
  required_outputs: []
  escalation_conditions: []
  completion_criteria: []
```

### artifact type: generated diff

```yaml
kind: generated_diff
schema_version: "0.3"
id: <diff id>
title: <diff title>
status: <proposed|verified|rejected|superseded>
owners:
  - <role or person>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <execution plan id>
      edge: produced_by
    - target_id: <behavior ids>
      edge: implements
    - target_id: <assumption ids>
      edge: depends_on
    - target_id: <contract ids>
      edge: depends_on
  downstream:
    - target_id: <verification ids>
      edge: proves
    - target_id: <execution eval ids>
      edge: evaluates
metadata:
  change_scope: <bounded|expanded|violated>
  summary: <short summary>
spec:
  changed_paths: []
  operations: []
  rationale: []
  spec_mappings: []
  assumption_mappings: []
  contract_mappings: []
  out_of_scope_findings: []
```

### artifact type: verification artifact

```yaml
kind: verification_artifact
schema_version: "0.3"
id: <verification id>
title: <verification title>
status: <draft|approved|obsolete>
owners:
  - <role or person>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <behavior ids>
      edge: proves
    - target_id: <contract ids>
      edge: proves
    - target_id: <generated diff ids>
      edge: depends_on
  downstream: []
metadata:
  verification_type: <acceptance_test|unit_test|integration_test|contract_check|property_check|review_checklist>
spec:
  location: <path or ref>
  proves: []
  execution_result: <pass|fail|not_run|waived>
  evidence_refs: []
```

### artifact type: execution eval

```yaml
kind: execution_eval
schema_version: "0.3"
id: <execution eval id>
title: <execution eval title>
status: <draft|completed|failed|waived>
owners:
  - <role or person>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <execution plan ids>
      edge: depends_on
    - target_id: <review gate ids>
      edge: depends_on
    - target_id: <generated diff ids>
      edge: evaluates
    - target_id: <execution log ids>
      edge: depends_on
  downstream: []
metadata:
  eval_type: <scope_check|policy_check|traceability_check|grounding_check|uncertainty_check|gate_check>
spec:
  subject_diff: <diff id>
  subject_gate: <gate id>
  result: <pass|warn|fail|escalate>
  findings: []
  evidence: []
```

### artifact type: execution log

```yaml
kind: execution_log
schema_version: "0.3"
id: <execution log id>
title: <execution log title>
status: <in_progress|completed|aborted>
owners:
  - <role or person>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <execution plan id>
      edge: depends_on
  downstream:
    - target_id: <generated diff ids>
      edge: produced_by
    - target_id: <execution eval ids>
      edge: evaluates
metadata:
  executor_type: <ai_agent|human|hybrid>
  executor_id: <optional identifier>
spec:
  consulted_artifacts: []
  steps: []
  emitted_outputs: []
  surfaced_uncertainties: []
  stop_conditions_triggered: []
  final_state: <completed|aborted|escalated>
```

### artifact type: waiver record

```yaml
kind: waiver_record
schema_version: "0.3"
id: <waiver id>
title: <waiver title>
status: <proposed|approved|expired|revoked>
owners:
  - <waiver authority>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <gate or rule id>
      edge: waives
    - target_id: <execution plan or diff id>
      edge: depends_on
  downstream:
    - target_id: <acceptance decision id>
      edge: depends_on
metadata:
  waiver_scope: <single_execution|time_bounded|artifact_bounded>
spec:
  waived_target: <gate id or rule id>
  justification: <why the waiver exists>
  authority: <role or person>
  valid_from: <ISO-8601 timestamp>
  valid_until: <ISO-8601 timestamp>
  compensating_controls: []
  residual_risks: []
```

### artifact type: acceptance decision

```yaml
kind: acceptance_decision
schema_version: "0.3"
id: <decision id>
title: <decision title>
status: <recorded|superseded>
owners:
  - <decision authority>
created_at: <ISO-8601 timestamp>
updated_at: <ISO-8601 timestamp>
trace:
  upstream:
    - target_id: <generated diff ids>
      edge: depends_on
    - target_id: <verification ids>
      edge: depends_on
    - target_id: <execution eval ids>
      edge: depends_on
    - target_id: <waiver ids>
      edge: depends_on
  downstream: []
metadata:
  outcome: <accepted|rejected|conditionally_accepted>
spec:
  subject_diffs: []
  decision_summary: <summary>
  reasons: []
  conditions: []
  residual_risks: []
  approvers: []
```

## traceability semantics

### required traceability rules

#### T1
Every generated diff MUST trace to at least one execution plan.

#### T2
Every execution plan MUST trace to at least one approved behavior spec.

#### T3
Every verification artifact MUST trace to at least one behavior spec or contract artifact.

#### T4
Every execution eval MUST trace to at least one execution plan and one review gate when gate-driven.

#### T5
If a generated diff implements behavior that depends on an accepted assumption, the diff SHOULD trace to that assumption.

#### T6
If a generated diff changes a machine boundary, it MUST trace to the relevant contract artifact.

## verification artifacts vs execution-phase evals

### verification artifacts
Verification artifacts prove that the generated implementation satisfies intended behavior or contract.

### execution-phase evals
Execution-phase evals assess whether the AI generation process itself stayed within approved scope, policy, traceability, and decision boundaries.

### normative distinction

- Verification artifacts MUST evaluate implementation correctness.
- Execution-phase evals MUST evaluate generation-process conformance.
- A single tool MAY implement both categories, but the evidence and result records MUST remain logically separate.

## execution gate taxonomy

### blocking gates
A blocking gate MUST prevent acceptance if its pass condition is not met and no valid waiver exists.

### warning gates
A warning gate does not block acceptance by itself, but MUST emit visible warning evidence.

### manual-review gates
A manual-review gate requires human inspection before acceptance.

### escalation gates
An escalation gate requires transfer to a defined authority because AI cannot proceed safely under current ambiguity or policy.

## AI execution contract

### required inputs
Before execution begins, the AI agent MUST receive:

1. one approved execution plan
2. one or more approved behavior specs
3. all required assumption records referenced by the execution plan
4. all relevant contract artifacts referenced by the execution plan
5. all applicable codegen policies
6. all applicable review gates
7. repository or code context limited to approved scope as needed

### allowed actions
The AI agent MAY:

- read approved inputs
- create or modify in-scope files
- generate or update required verification artifacts
- emit uncertainty reports
- emit trace mappings from spec to code
- propose contract updates only if the execution plan explicitly allows it

### forbidden actions
The AI agent MUST NOT:

- modify out-of-scope paths
- invent new product behavior not grounded in approved inputs
- introduce forbidden dependencies or patterns
- silently resolve critical ambiguity
- suppress or omit required outputs
- alter never-modify files defined by policy

### required outputs
The AI agent MUST emit:

1. generated diff
2. updated or new verification artifacts required by the plan
3. trace mapping from changed code to behavior ids
4. uncertainty report when applicable
5. generation log sufficient for execution-phase evaluation

### stop conditions
The AI agent MUST stop and escalate when:

1. a critical or high-impact assumption required for correctness is unresolved
2. execution requires a forbidden operation
3. execution would modify out-of-scope or never-modify paths
4. required contract information is missing or contradictory
5. a new dependency or architectural move is needed but not approved
6. the behavior spec is too ambiguous to implement safely within policy

### completion conditions
The AI agent MAY declare execution complete only when:

- all required outputs are emitted
- no blocking gate is known to fail
- all changes remain within approved scope
- all surfaced ambiguities have been resolved or escalated

## cross-artifact referential integrity

A BDSK implementation-grade validator MUST perform repository-level referential integrity checks in addition to per-artifact schema validation.

### integrity rules

#### RI-1: referenced artifact existence
Every `target_id` appearing in a structured trace reference MUST resolve to an existing artifact in the repository or registry.

#### RI-2: kind compatibility
A referenced artifact MUST be compatible with the edge type and source artifact kind.

#### RI-3: approval-state requirements
Artifacts referenced as governing inputs to execution MUST be approved unless explicitly allowed otherwise.

#### RI-4: diff mapping completeness
Every generated diff MUST reference at least one governing execution plan and at least one implemented behavior spec, unless the execution plan explicitly marks the diff as policy-only or documentation-only.

#### RI-5: verification coverage
Every approved behavior spec included in an execution plan MUST have at least one associated verification artifact before acceptance.

#### RI-6: gate evaluation coverage
Every review gate referenced by an execution plan MUST have a corresponding execution-phase evaluation result or an approved waiver before acceptance.

#### RI-7: waiver target validity
A waiver record MUST point to an existing waivable target.

#### RI-8: acceptance evidence completeness
An acceptance decision MUST NOT be recorded as accepted or conditionally accepted unless all required evidence exists.

#### RI-9: supersession consistency
If an artifact supersedes another artifact, the superseded artifact SHOULD remain immutable and discoverable.

#### RI-10: execution completion integrity
An execution MUST NOT be marked complete if any stop condition was reached without an associated escalation, rejection, or approved waiver path.

## authority and approval model

### canonical authority roles
Implementations SHOULD define authority roles explicitly. A minimum recommended authority model is:

- `product_authority`
- `technical_authority`
- `security_authority`
- `qa_authority`
- `compliance_authority`
- `release_authority`

### authority matrix

| artifact or decision | minimum required authority |
|---|---|
| behavior spec approval | product_authority or technical_authority |
| assumption acceptance for product behavior | product_authority |
| assumption acceptance for architecture | technical_authority |
| assumption acceptance for security-sensitive behavior | security_authority |
| codegen policy approval | technical_authority |
| review gate approval | technical_authority, and security_authority when security-related |
| execution plan approval | technical_authority |
| waiver approval for warning or manual-review gate | technical_authority or qa_authority |
| waiver approval for blocking security gate | security_authority |
| acceptance decision | release_authority, with qa_authority for production-bound changes |

### authority rules

#### AU-1
Every approval-bearing artifact SHOULD record the authority role used for approval.

#### AU-2
A single person MAY hold multiple authority roles, but the recorded role used for each decision SHOULD be explicit.

#### AU-3
A waiver MUST be approved by an authority permitted to waive the target class.

#### AU-4
An escalation MUST resolve to a defined authority role.

#### AU-5
An acceptance decision MUST identify its approvers and the authority roles under which they acted.

## lifecycle

### phase 1: discovery
Surface rules, examples, and open questions.

### phase 2: specification
Formalize intended behavior using concrete examples.

### phase 3: constraint definition
Define what AI is allowed to do during implementation.

### phase 4: execution
Allow AI to generate or modify code under BDSK governance.

### phase 5: execution evaluation
Determine whether the AI generation process stayed within approved boundaries.

### phase 6: verification
Confirm generated code matches the specification and contracts.

### phase 7: acceptance
Approve or reject the generated implementation.

## normative algorithms

### algorithm A: execution start validation

Before execution begins, the validator MUST:
1. validate all referenced artifacts against schemas
2. resolve all references required by the execution plan
3. verify approval-state requirements for governing artifacts
4. verify authority requirements for approvals
5. verify that no referenced high- or critical-impact assumption is unresolved
6. verify that all required codegen policies and review gates are present
7. block execution start if any required condition fails

### algorithm B: stop-condition evaluation during execution

After each material generation step, the executor or supervising validator MUST check whether a stop condition has been triggered and record the result in the execution log.

### algorithm C: gate evaluation

After execution emits a diff and execution log, the validator MUST evaluate all applicable review gates and record execution eval results.

### algorithm D: verification evaluation

Before acceptance, the validator MUST confirm that required behavior and contract evidence exists and that required verification artifacts pass.

### algorithm E: acceptance computation

A tool MUST NOT compute `accepted` unless all of the following are true:
1. required verification artifacts exist and pass
2. required execution evals exist
3. no unwaived blocking gate failures remain
4. no unresolved manual-review or escalation gates remain
5. no unresolved stop-condition breach remains
6. acceptance decision is approved by the required authority or authorities

A tool MAY compute `conditionally_accepted` if all blocking conditions are satisfied or waived but residual non-blocking conditions remain and are recorded explicitly.

Otherwise the outcome MUST be `rejected`.

## machine-readable JSON Schema pack

The following JSON Schemas provide a minimum implementation-grade reference for core BDSK artifacts.

### common definitions

```json
{
  "$id": "https://bdsk.dev/schemas/common.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$defs": {
    "id": { "type": "string", "minLength": 1 },
    "timestamp": { "type": "string", "format": "date-time" },
    "traceEdge": {
      "type": "string",
      "enum": ["depends_on", "derived_from", "constrains", "implements", "proves", "evaluates", "produced_by", "supersedes", "escalates_to", "waives"]
    },
    "traceRef": {
      "type": "object",
      "required": ["target_id", "edge"],
      "properties": {
        "target_id": { "$ref": "#/$defs/id" },
        "edge": { "$ref": "#/$defs/traceEdge" }
      },
      "additionalProperties": false
    },
    "trace": {
      "type": "object",
      "required": ["upstream", "downstream"],
      "properties": {
        "upstream": { "type": "array", "items": { "$ref": "#/$defs/traceRef" } },
        "downstream": { "type": "array", "items": { "$ref": "#/$defs/traceRef" } }
      },
      "additionalProperties": false
    },
    "owners": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string", "minLength": 1 }
    },
    "artifactEnvelope": {
      "type": "object",
      "required": ["kind", "schema_version", "id", "title", "status", "owners", "created_at", "updated_at", "trace", "spec"],
      "properties": {
        "kind": { "type": "string", "minLength": 1 },
        "schema_version": { "const": "0.3" },
        "id": { "$ref": "#/$defs/id" },
        "title": { "type": "string", "minLength": 1 },
        "status": { "type": "string", "minLength": 1 },
        "owners": { "$ref": "#/$defs/owners" },
        "created_at": { "$ref": "#/$defs/timestamp" },
        "updated_at": { "$ref": "#/$defs/timestamp" },
        "trace": { "$ref": "#/$defs/trace" },
        "metadata": { "type": "object" },
        "spec": { "type": "object" }
      },
      "additionalProperties": false
    }
  }
}
```

### schemas included

The reference schema pack MUST include schemas for:
- behavior_spec
- assumption_record
- contract_artifact
- codegen_policy
- review_gate
- execution_plan
- generated_diff
- verification_artifact
- execution_eval
- execution_log
- waiver_record
- acceptance_decision

## reference implementation layout

```text
bdsk/
  artifacts/
    behaviors/
    assumptions/
    contracts/
    policies/
    gates/
    execution-plans/
    diffs/
    verifications/
    execution-evals/
    execution-logs/
    waivers/
    acceptance/
  schemas/
    common.json
    behavior_spec.json
    assumption_record.json
    contract_artifact.json
    codegen_policy.json
    review_gate.json
    execution_plan.json
    generated_diff.json
    verification_artifact.json
    execution_eval.json
    execution_log.json
    waiver_record.json
    acceptance_decision.json
```

## implementation rules for tooling

A tool that claims BDSK implementation-grade support SHOULD do the following:

1. validate structured artifacts against the JSON Schemas
2. reject malformed trace objects and non-canonical trace edges
3. enforce cross-artifact referential integrity rules RI-1 through RI-10
4. reject execution plans that reference missing or invalid governing artifacts
5. reject generated diffs with no behavior mappings when mappings are required
6. separate verification results from execution-phase eval results in storage and reporting
7. enforce stop conditions before accepting execution completion
8. preserve superseded artifacts rather than mutating history destructively
9. support waiver application only through explicit waiver records
10. enforce authority checks for approvals, waivers, escalations, and acceptance decisions
11. compute acceptance using Algorithm E rather than ad hoc status mutation

## reference validator specification

### purpose
The BDSK reference validator is a normative validation model for determining whether a repository, execution, or acceptance decision conforms to BDSK v0.3.

### inputs it scans
The validator MUST scan:
1. structured BDSK artifacts
2. artifact index information
3. optional supporting sources such as raw diff metadata, test results, contract validation outputs, policy engine outputs, and approval records

### validator phases

#### V1: artifact discovery
- discover all structured artifacts
- build an artifact index keyed by `id`
- reject duplicate artifact ids

#### V2: schema validation
- validate each structured artifact against its canonical JSON Schema

#### V3: trace validation
- validate normalized trace shape
- validate canonical edge vocabulary

#### V4: referential integrity validation
- apply RI-1 through RI-10

#### V5: authority validation
- validate approval, waiver, escalation, and acceptance authorities

#### V6: execution conformance validation
- validate execution start preconditions
- validate stop-condition handling
- validate review gate coverage and execution eval results
- validate execution log completeness

#### V7: verification coverage validation
- validate required behavior and contract evidence
- validate separation of verification artifacts from execution evals

#### V8: acceptance validation
- compute acceptance eligibility using Algorithm E
- compare computed result with recorded acceptance decision if present

### validator error model
Each finding MUST include:
- `code`
- `severity`
- `category`
- `artifact_id`
- `message`
- `details`

### canonical validator error codes

#### schema
- `BDSK-SCHEMA-001` duplicate artifact id
- `BDSK-SCHEMA-002` artifact fails JSON Schema validation
- `BDSK-SCHEMA-003` unsupported schema version

#### trace
- `BDSK-TRACE-001` malformed trace object
- `BDSK-TRACE-002` invalid trace edge type
- `BDSK-TRACE-003` non-normalized trace representation
- `BDSK-TRACE-004` incompatible edge for source or target kinds

#### reference
- `BDSK-REF-001` missing referenced artifact
- `BDSK-REF-002` governing artifact not approved
- `BDSK-REF-003` required verification coverage missing
- `BDSK-REF-004` required execution eval missing
- `BDSK-REF-005` diff missing required behavior mapping

#### authority
- `BDSK-AUTH-001` missing required authority role
- `BDSK-AUTH-002` invalid waiver authority
- `BDSK-AUTH-003` invalid acceptance approver set
- `BDSK-AUTH-004` escalation has no valid authority target

#### execution
- `BDSK-EXEC-001` execution plan missing required input
- `BDSK-EXEC-002` unresolved critical assumption at execution start
- `BDSK-EXEC-003` stop condition triggered without valid escalation or abort
- `BDSK-EXEC-004` execution log missing or incomplete
- `BDSK-EXEC-005` out-of-scope change detected

#### gate
- `BDSK-GATE-001` blocking gate failed without waiver
- `BDSK-GATE-002` manual-review gate unresolved
- `BDSK-GATE-003` escalation gate unresolved
- `BDSK-GATE-004` gate evaluation missing

#### verification
- `BDSK-VER-001` missing behavior verification artifact
- `BDSK-VER-002` missing contract verification artifact
- `BDSK-VER-003` verification artifact result is failing
- `BDSK-VER-004` verification and execution eval evidence mixed improperly

#### waiver
- `BDSK-WAIVER-001` waiver targets non-waivable requirement
- `BDSK-WAIVER-002` waiver expired at validation time
- `BDSK-WAIVER-003` waiver authority not permitted

#### acceptance
- `BDSK-ACC-001` acceptance recorded without complete evidence
- `BDSK-ACC-002` recorded acceptance outcome does not match computed outcome
- `BDSK-ACC-003` conditionally accepted decision missing conditions
- `BDSK-ACC-004` accepted decision contains unresolved blocking failure

### pass/fail computation

#### repository conformance
A repository snapshot is `conformant` only if no schema, trace, reference, or authority errors exist.

#### execution acceptance eligibility
A specific execution is `acceptance_eligible` only if:
- execution start validation passes
- no unresolved stop-condition breach exists
- all required review gates are evaluated
- no unwaived blocking gate failure exists
- no unresolved manual-review or escalation gate exists
- required verification artifacts exist and pass
- required execution evals exist
- required authorities are present for acceptance

### conformance decision rules
The validator MUST compute:
- repository outcome: `conformant` or `non_conformant`
- execution outcome: `accepted`, `conditionally_accepted`, `rejected`, or `indeterminate`

### conformance report
The validator MUST emit a machine-readable conformance report.

```yaml
validator_version: <version>
spec_version: "0.3"
repository_outcome: <conformant|non_conformant>
summary:
  artifact_count: <number>
  schema_failures: <number>
  warnings: <number>
  errors: <number>
artifacts_scanned:
  - id: <artifact id>
    kind: <artifact kind>
    status: <artifact status>
execution_results:
  - execution_plan_id: <id>
    outcome: <accepted|conditionally_accepted|rejected|indeterminate>
    blocking_failures: []
    warnings: []
    evidence:
      verification_artifacts: []
      execution_evals: []
      waivers: []
findings:
  - code: <validator code>
    severity: <error|warning>
    category: <category>
    artifact_id: <optional>
    message: <human-readable explanation>
    details: {}
```

### validator output semantics
- The validator MUST NOT silently coerce a failing repository into a conformant state.
- The validator MUST report computed outcomes even when a recorded acceptance decision disagrees.
- The validator SHOULD expose both artifact-level and execution-level findings.

## summary

BDSK turns behavior-driven specification into a governance system for AI-assisted code generation.

Its core contribution is not runtime orchestration. Its core contribution is making human intent concrete, traceable, and enforceable enough that AI can generate code within explicit boundaries rather than guessing its way through ambiguity.

Version 0.3 is a cleaned, implementation-grade draft with canonical artifacts, normalized trace semantics, explicit authority and approval rules, repository-level referential integrity, an execution log model, normative algorithms, and a reference validator specification.

