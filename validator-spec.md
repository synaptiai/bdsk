# BDSK Reference Validator -- Architecture Specification

## status

Draft

## spec alignment

BDSK v0.3

## 1. overview

### 1.1 what this is

The BDSK reference validator determines whether a repository of BDSK artifacts conforms to the BDSK v0.3 specification. It answers two questions:

1. **Repository conformance**: Does this set of artifacts form a structurally valid BDSK repository? (No schema errors, no trace errors, no referential integrity violations, no authority violations.)
2. **Execution acceptance eligibility**: For each execution plan in the repository, does it meet all conditions for acceptance per Algorithm E?

### 1.2 what this is not

The validator does not execute AI agents, does not generate code, does not run tests, and does not deploy anything. It reads structured YAML/JSON artifacts and produces a conformance report.

### 1.3 users

- Engineers implementing BDSK governance in their repositories
- AI agents checking their own outputs against BDSK rules before proposing acceptance
- CI/CD pipelines gating merges on BDSK conformance
- Auditors reviewing whether a BDSK-governed execution was legitimate

### 1.4 success criteria

A correct validator implementation MUST:

- Accept every conformant repository that a perfect human auditor would accept
- Reject every non-conformant repository that a perfect human auditor would reject
- Produce deterministic output given identical input
- Produce a machine-readable conformance report matching the spec-mandated schema

## 2. design decisions

### 2.1 language

The architecture is specified in terms of interfaces and algorithms, not language-specific constructs. The recommended reference implementation language is TypeScript:

- YAML and JSON parsing are native strengths
- JSON Schema validation has mature libraries (ajv with 2020-12 support)
- TypeScript's type system encodes the artifact kind/edge/status enumerations precisely

A Python, Rust, or Go implementation following the same interfaces would be equally valid.

### 2.2 architecture

Hybrid phased pipeline with shared artifact graph.

- **Pipeline**: Phases V1 through V8 execute sequentially. Each phase receives the shared artifact graph and appends findings to a shared findings list.
- **Graph**: V1 builds an ArtifactIndex (a map from artifact ID to parsed artifact). V4 through V8 operate over this index as a directed graph, traversing trace edges to check referential integrity, authority chains, and acceptance conditions.

### 2.3 early termination semantics

| condition | behavior |
|---|---|
| V1 finds duplicate IDs | Record findings; continue V2 only for non-duplicate artifacts; proceed to V3-V8 with the deduplicated subset |
| V2 finds schema failures | Record findings; skip V4-V8 for artifacts that fail schema validation (their internal structure is unreliable) |
| V3 finds trace failures | Record findings; skip V4 referential integrity for artifacts with malformed traces |
| Any phase produces errors | Continue all remaining phases; do NOT short-circuit the entire pipeline |

Rationale: report all discoverable errors in a single run rather than forcing the user to fix-and-rerun iteratively.

### 2.4 artifact file format

The validator MUST accept YAML files (`.yaml`, `.yml`). It SHOULD also accept JSON files (`.json`). Each file MUST contain exactly one artifact. Multi-document YAML files (containing `---` separators with multiple artifacts per file) MUST NOT be supported in v1.

### 2.5 output formats

The spec mandates a YAML conformance report. The validator MUST also support JSON output (structurally identical, different serialization). A human-readable summary mode SHOULD be available for terminal output.

## 3. core data model

### 3.1 ParsedArtifact

Every loaded artifact is represented as a ParsedArtifact after V1:

```
ParsedArtifact {
  id: string                    // from envelope.id
  kind: ArtifactKind            // enum of 12 kinds
  schema_version: string        // "0.3"
  status: string                // kind-specific status
  title: string
  owners: string[]
  created_at: string            // ISO-8601
  updated_at: string            // ISO-8601
  trace: Trace
  metadata: object              // kind-specific
  spec: object                  // kind-specific
  source_path: string           // filesystem path where this artifact was loaded
  raw: object                   // original parsed YAML/JSON for schema validation
}
```

### 3.2 ArtifactKind

Exactly 12 values:

```
behavior_spec
assumption_record
contract_artifact
codegen_policy
review_gate
execution_plan
generated_diff
verification_artifact
execution_eval
execution_log
waiver_record
acceptance_decision
```

### 3.3 Trace

```
Trace {
  upstream: TraceRef[]
  downstream: TraceRef[]
}

TraceRef {
  target_id: string
  edge: TraceEdge
}
```

### 3.4 TraceEdge

Exactly 10 values:

```
depends_on
derived_from
constrains
implements
proves
evaluates
produced_by
supersedes
escalates_to
waives
```

### 3.5 ArtifactIndex

The central data structure shared across all phases:

```
ArtifactIndex {
  byId: Map<string, ParsedArtifact>
  byKind: Map<ArtifactKind, ParsedArtifact[]>

  get(id: string): ParsedArtifact | undefined
  allOfKind(kind: ArtifactKind): ParsedArtifact[]

  // graph traversal
  upstreamOf(id: string, edgeFilter?: TraceEdge): ParsedArtifact[]
  downstreamOf(id: string, edgeFilter?: TraceEdge): ParsedArtifact[]

  // reverse index: who points TO this artifact?
  incomingRefs(id: string, edgeFilter?: TraceEdge): ParsedArtifact[]
}
```

The `incomingRefs` reverse index is critical for RI-5 (finding verification artifacts that prove a given behavior spec) and RI-6 (finding execution evals that evaluate a given gate).

### 3.6 Finding

```
Finding {
  code: string              // e.g. "BDSK-SCHEMA-001"
  severity: "error" | "warning"
  category: FindingCategory
  artifact_id: string | null
  message: string
  details: object
}
```

### 3.7 FindingCategory

```
schema
trace
reference
authority
execution
gate
verification
waiver
acceptance
```

## 4. edge-kind compatibility matrix

This matrix defines which `(source_kind, edge, target_kind)` triples are valid. It is derived from all 12 artifact trace definitions in the spec.

### upstream edges (source artifact contains the trace reference)

| source kind | edge | valid target kinds |
|---|---|---|
| behavior_spec | derived_from | behavior_spec, assumption_record |
| behavior_spec | depends_on | assumption_record, contract_artifact |
| assumption_record | derived_from | behavior_spec, assumption_record, contract_artifact |
| contract_artifact | _(no upstream edges specified)_ | |
| codegen_policy | derived_from | codegen_policy |
| review_gate | depends_on | codegen_policy, behavior_spec |
| execution_plan | depends_on | behavior_spec, assumption_record, contract_artifact, codegen_policy, review_gate |
| generated_diff | produced_by | execution_plan |
| generated_diff | implements | behavior_spec |
| generated_diff | depends_on | assumption_record, contract_artifact |
| verification_artifact | proves | behavior_spec, contract_artifact |
| verification_artifact | depends_on | generated_diff |
| execution_eval | depends_on | execution_plan, review_gate, execution_log |
| execution_eval | evaluates | generated_diff |
| execution_log | depends_on | execution_plan |
| waiver_record | waives | review_gate |
| waiver_record | depends_on | execution_plan, generated_diff |
| acceptance_decision | depends_on | generated_diff, verification_artifact, execution_eval, waiver_record |

### downstream edges (source artifact contains the trace reference)

| source kind | edge | valid target kinds |
|---|---|---|
| behavior_spec | proves | verification_artifact |
| behavior_spec | constrains | execution_plan |
| assumption_record | constrains | behavior_spec, generated_diff |
| contract_artifact | constrains | behavior_spec |
| contract_artifact | proves | verification_artifact |
| codegen_policy | constrains | execution_plan, review_gate |
| review_gate | evaluates | execution_eval |
| execution_plan | produced_by | generated_diff |
| execution_plan | evaluates | execution_eval, execution_log |
| generated_diff | proves | verification_artifact |
| generated_diff | evaluates | execution_eval |
| execution_log | produced_by | generated_diff |
| execution_log | evaluates | execution_eval |
| waiver_record | depends_on | acceptance_decision |

Implementation note: this matrix MUST be encoded as a static lookup table. For RI-2 and BDSK-TRACE-004, the validator checks every trace reference against this table.

## 5. validation phases

### 5.1 V1: artifact discovery

**Input**: a filesystem path (the repository root).

**Algorithm**:

1. Resolve the artifact root. By default, scan `<repo>/artifacts/` recursively. If a config file specifies alternative paths, scan those instead.
2. For each file matching `*.yaml`, `*.yml`, or `*.json`:
   a. Parse the file as YAML (which subsumes JSON).
   b. If parsing fails, record `BDSK-SCHEMA-002`, severity `error`, category `schema`, and skip the file.
   c. If the parsed document does not have a `kind` field, skip it silently (it is not a BDSK artifact).
   d. If the `kind` value is not in the 12-kind enumeration, record `BDSK-SCHEMA-002` and skip.
   e. If `id` is missing, record `BDSK-SCHEMA-002` and skip.
   f. If `id` is already present in the index, record `BDSK-SCHEMA-001` (duplicate artifact id), severity `error`. Keep the first-encountered artifact; skip the duplicate.
   g. Otherwise, construct a ParsedArtifact and insert it into the ArtifactIndex.
3. Build the reverse-reference index by iterating all trace references in all indexed artifacts.

**Output**: ArtifactIndex, list of V1 findings.

### 5.2 V2: schema validation

**Input**: ArtifactIndex.

**Algorithm**:

1. Load JSON Schema definitions. These MUST be bundled with the validator. The spec defines 12 kind-specific schemas plus `common.json`.
2. For each artifact in the index:
   a. Select the JSON Schema corresponding to `artifact.kind`.
   b. Validate `artifact.raw` against the schema.
   c. If validation fails, record `BDSK-SCHEMA-002` for each schema violation. Include the JSON Schema validation error path and message in `details`.
   d. Check `schema_version`. If not `"0.3"`, record `BDSK-SCHEMA-003`.
3. Mark artifacts that failed schema validation as `schema_invalid` in the index. Later phases SHOULD skip these artifacts for structural checks.

**Output**: updated findings list; annotations on artifacts that failed.

### 5.3 V3: trace validation

**Input**: ArtifactIndex (schema-valid artifacts only).

**Algorithm**:

1. For each artifact:
   a. Verify `trace` field exists and has both `upstream` and `downstream` arrays (TR-1). If not, record `BDSK-TRACE-001`.
   b. For each trace reference in both arrays:
      - Verify it has exactly two fields: `target_id` and `edge` (TR-2). Extra fields produce `BDSK-TRACE-003`.
      - Verify `edge` is one of the 10 canonical values. Invalid values produce `BDSK-TRACE-002`.
   c. Check edge-kind compatibility against the matrix in section 4. If the `(source_kind, edge, target_kind)` triple is not valid, record `BDSK-TRACE-004`.

**Output**: updated findings list.

### 5.4 V4: referential integrity validation

**Input**: ArtifactIndex, reverse reference index.

Each sub-rule is implemented as an independent check function.

#### RI-1: referenced artifact existence

For every `target_id` in every trace reference across all artifacts, look up the target in the index. If not found, record `BDSK-REF-001`.

#### RI-2: kind compatibility

Covered by V3's BDSK-TRACE-004 for resolved references. V4 re-checks resolved references to ensure the target artifact's actual kind matches the expected kind from the compatibility matrix.

#### RI-3: governing input approval state

For each execution_plan:
- Collect all upstream `depends_on` references.
- For each referenced artifact, check that `status` is `approved` (or `accepted` for assumption_records).
- If not, record `BDSK-REF-002`.

#### RI-4: diff mapping completeness

For each generated_diff:
- Check that at least one upstream trace has `edge: produced_by` pointing to an execution_plan.
- Check that at least one upstream trace has `edge: implements` pointing to a behavior_spec.
- Exception: if the execution plan explicitly marks the diff as policy-only or documentation-only, the behavior mapping requirement is relaxed.
- If violated, record `BDSK-REF-005`.

#### RI-5: verification coverage

For each execution_plan:
- Collect all behavior specs referenced in `spec.required_inputs.behaviors`.
- For each behavior spec, use the reverse index to find all verification_artifact entries that have `edge: proves` targeting this behavior spec.
- If no such verification artifact exists, record `BDSK-REF-003`.

#### RI-6: gate evaluation coverage

For each execution_plan:
- Collect all review gates referenced in `spec.required_inputs.review_gates`.
- For each gate, use the reverse index to find execution_eval entries that reference this gate.
- If no eval and no approved waiver exists, record `BDSK-REF-004`.

#### RI-7: waiver target validity

For each waiver_record:
- Check that `spec.waived_target` resolves to an existing artifact in the index.
- Check that the target is a review_gate or is otherwise waivable.
- If the target does not exist or is not waivable, record `BDSK-WAIVER-001`.

#### RI-8: acceptance evidence completeness

For each acceptance_decision where `metadata.outcome` is `accepted` or `conditionally_accepted`:
- Check that `spec.subject_diffs` is non-empty and all referenced diffs exist.
- Check that upstream `depends_on` references include verification artifacts and execution evals.
- If evidence is incomplete, record `BDSK-ACC-001`.

#### RI-9: supersession consistency

For every trace reference with `edge: supersedes`:
- Check that the superseded artifact's `status` is `superseded` or `archived`.
- If the superseded artifact has been modified after the superseding artifact's `created_at`, record a warning.

#### RI-10: execution completion integrity

For each execution_log where `spec.final_state` is `completed`:
- Check `spec.stop_conditions_triggered`.
- If any stop condition was triggered, verify that there is a corresponding escalation, rejection, or approved waiver.
- If not, record `BDSK-EXEC-003`.

### 5.5 V5: authority validation

**Input**: ArtifactIndex, optional authority configuration.

Implements rules AU-1 through AU-5 and the authority matrix from the spec.

#### default authority matrix

| artifact or decision | minimum required authority |
|---|---|
| behavior spec approval | product_authority or technical_authority |
| assumption acceptance for product behavior | product_authority |
| assumption acceptance for architecture | technical_authority |
| assumption acceptance for security-sensitive behavior | security_authority |
| codegen policy approval | technical_authority |
| review gate approval | technical_authority, and security_authority when security-related |
| execution plan approval | technical_authority |
| waiver for warning or manual-review gate | technical_authority or qa_authority |
| waiver for blocking security gate | security_authority |
| acceptance decision | release_authority, with qa_authority for production-bound changes |

#### checks

1. **AU-1 approval authority**: For each artifact with status `approved`, check that at least one owner holds the required authority role per the matrix. If authority role is not recorded, record `BDSK-AUTH-001`.

2. **AU-3 waiver authority**: For each waiver_record with status `approved`, determine the class of the waived target and check that `spec.authority` holds the required role. If not, record `BDSK-AUTH-002`.

3. **AU-4 escalation authority**: For each trace with `edge: escalates_to`, check that the target resolves to a defined authority role. If not, record `BDSK-AUTH-004`.

4. **AU-5 acceptance authority**: For each acceptance_decision, check that `spec.approvers` is non-empty, each approver maps to a valid authority role, and the roles satisfy the matrix. If not, record `BDSK-AUTH-003`.

**Configuration**: the default matrix from the spec is the baseline. Repositories MAY provide a stricter matrix via config but MUST NOT weaken the defaults.

### 5.6 V6: execution conformance validation

**Input**: ArtifactIndex.

Implements Algorithms A, B, and C from the spec.

#### algorithm A: execution start validation

For each execution_plan:

1. All referenced artifacts pass schema validation (cross-check with V2 results).
2. All references in the plan resolve (cross-check with RI-1).
3. Governing artifacts are approved (cross-check with RI-3).
4. Authority requirements satisfied (cross-check with V5).
5. No referenced assumption_record with `metadata.impact_level` of `high` or `critical` has `status` of `proposed` or `needs-review`. If violated, record `BDSK-EXEC-002`.
6. All required codegen policies exist (check `spec.required_inputs.policies`). If missing, record `BDSK-EXEC-001`.
7. All required review gates exist (check `spec.required_inputs.review_gates`). If missing, record `BDSK-EXEC-001`.

#### algorithm B: stop-condition evaluation

For each execution_log associated with an execution plan:
- Check `spec.stop_conditions_triggered`.
- For each triggered stop condition, verify the log records how it was handled (escalated, aborted, or waived).
- If a stop condition was reached but not handled, record `BDSK-EXEC-003`.

#### algorithm C: gate evaluation

For each execution plan, for each review gate in `spec.required_inputs.review_gates`:
- Find the corresponding execution_eval by matching `spec.subject_gate`.
- Check the eval's `spec.result`:
  - If `fail` and gate is `blocking`: check for an approved waiver. If none, record `BDSK-GATE-001`.
  - If gate is `manual-review` and no eval exists or result is not `pass`: record `BDSK-GATE-002`.
  - If gate is `escalation` and no eval exists or result is not `pass`: record `BDSK-GATE-003`.
  - If no eval exists at all: record `BDSK-GATE-004`.

### 5.7 V7: verification coverage validation

**Input**: ArtifactIndex.

Implements Algorithm D from the spec.

For each execution_plan:

1. **Behavior coverage**: For each behavior spec in `spec.required_inputs.behaviors`, find verification artifacts that prove it (via reverse index, `edge: proves`). If none exist, record `BDSK-VER-001`. If they exist but `spec.execution_result` is `fail`, record `BDSK-VER-003`.

2. **Contract coverage**: For each contract artifact referenced by the plan, find verification artifacts that prove it. If none, record `BDSK-VER-002`.

3. **Separation check**: Verify that no single artifact ID appears as both a verification_artifact and an execution_eval. If it does, record `BDSK-VER-004`.

### 5.8 V8: acceptance validation

**Input**: ArtifactIndex, all findings from V1-V7.

Implements Algorithm E from the spec.

For each acceptance_decision in the repository:

**Step 1: compute the expected outcome.**

Check all 6 conditions for `accepted`:

1. Required verification artifacts exist and pass (from V7).
2. Required execution evals exist (from V6).
3. No unwaived blocking gate failures remain (from V6 / Algorithm C).
4. No unresolved manual-review or escalation gates remain (from V6 / Algorithm C).
5. No unresolved stop-condition breach remains (from V6 / Algorithm B).
6. Acceptance decision is approved by required authority (from V5).

If all 6 pass: computed outcome is `accepted`.

If all blocking conditions are satisfied or waived but non-blocking warnings remain: computed outcome is `conditionally_accepted`. In this case, verify that `spec.conditions` is non-empty; if empty, record `BDSK-ACC-003`.

Otherwise: computed outcome is `rejected`.

**Step 2: compare with recorded outcome.**

If `metadata.outcome` does not match the computed outcome, record `BDSK-ACC-002`.

If outcome is `accepted` but the validator found blocking failures, record `BDSK-ACC-004`.

## 6. error code registry

### schema errors

| code | phase | severity | condition |
|---|---|---|---|
| BDSK-SCHEMA-001 | V1 | error | Duplicate artifact ID in repository |
| BDSK-SCHEMA-002 | V2 | error | Artifact fails JSON Schema validation |
| BDSK-SCHEMA-003 | V2 | error | Unsupported schema_version (not "0.3") |

### trace errors

| code | phase | severity | condition |
|---|---|---|---|
| BDSK-TRACE-001 | V3 | error | Malformed trace object (missing upstream/downstream) |
| BDSK-TRACE-002 | V3 | error | Invalid trace edge type (not in canonical 10) |
| BDSK-TRACE-003 | V3 | error | Non-normalized trace representation (extra fields in traceRef) |
| BDSK-TRACE-004 | V3 | error | Edge type incompatible with source/target kinds |

### reference errors

| code | phase | severity | condition |
|---|---|---|---|
| BDSK-REF-001 | V4 | error | target_id does not resolve to existing artifact |
| BDSK-REF-002 | V4 | error | Governing input artifact not in approved status |
| BDSK-REF-003 | V4 | error | Behavior spec lacks verification coverage |
| BDSK-REF-004 | V4 | error | Execution eval missing for required review gate |
| BDSK-REF-005 | V4 | error | Generated diff missing required behavior mapping |

### authority errors

| code | phase | severity | condition |
|---|---|---|---|
| BDSK-AUTH-001 | V5 | error | Approval missing required authority role |
| BDSK-AUTH-002 | V5 | error | Waiver authority not permitted for target class |
| BDSK-AUTH-003 | V5 | error | Acceptance approver set does not satisfy authority matrix |
| BDSK-AUTH-004 | V5 | error | Escalation resolves to undefined authority |

### execution errors

| code | phase | severity | condition |
|---|---|---|---|
| BDSK-EXEC-001 | V6 | error | Execution plan missing required input |
| BDSK-EXEC-002 | V6 | error | Unresolved critical/high assumption at execution start |
| BDSK-EXEC-003 | V6 | error | Stop condition triggered without valid escalation/abort/waiver |
| BDSK-EXEC-004 | V6 | warning | Execution log missing or incomplete |
| BDSK-EXEC-005 | V6 | error | Out-of-scope change detected in diff |

### gate errors

| code | phase | severity | condition |
|---|---|---|---|
| BDSK-GATE-001 | V6 | error | Blocking gate failed without approved waiver |
| BDSK-GATE-002 | V6 | error | Manual-review gate unresolved |
| BDSK-GATE-003 | V6 | error | Escalation gate unresolved |
| BDSK-GATE-004 | V6 | warning | Gate evaluation missing (no eval found for gate) |

### verification errors

| code | phase | severity | condition |
|---|---|---|---|
| BDSK-VER-001 | V7 | error | Missing behavior verification artifact |
| BDSK-VER-002 | V7 | error | Missing contract verification artifact |
| BDSK-VER-003 | V7 | error | Verification artifact result is fail |
| BDSK-VER-004 | V7 | warning | Verification and execution eval evidence mixed improperly |

### waiver errors

| code | phase | severity | condition |
|---|---|---|---|
| BDSK-WAIVER-001 | V4 | error | Waiver targets non-waivable or non-existent target |
| BDSK-WAIVER-002 | V4 | warning | Waiver expired at validation time |
| BDSK-WAIVER-003 | V5 | error | Waiver authority not permitted |

### acceptance errors

| code | phase | severity | condition |
|---|---|---|---|
| BDSK-ACC-001 | V8 | error | Acceptance recorded without complete evidence |
| BDSK-ACC-002 | V8 | error | Recorded outcome disagrees with Algorithm E computation |
| BDSK-ACC-003 | V8 | warning | Conditionally accepted but conditions list empty |
| BDSK-ACC-004 | V8 | error | Accepted decision contains unresolved blocking failure |

## 7. CLI contract

### 7.1 command

```
bdsk-validate [options] [path]
```

If `path` is omitted, default to the current working directory.

### 7.2 flags

| flag | short | type | default | description |
|---|---|---|---|---|
| `--format` | `-f` | `yaml \| json \| text` | `text` | Output format |
| `--output` | `-o` | filepath | stdout | Write report to file |
| `--artifacts-dir` | `-a` | dirpath | `artifacts/` | Relative path from repo root to artifact directory |
| `--schemas-dir` | `-s` | dirpath | (bundled) | Path to custom JSON Schema directory |
| `--config` | `-c` | filepath | `.bdsk/config.yaml` | Path to validator configuration file |
| `--phase` | `-p` | `v1\|v2\|...\|v8\|all` | `all` | Run only a specific phase |
| `--execution` | `-e` | artifact-id | (all) | Validate only a specific execution plan |
| `--strict` | | boolean | false | Treat warnings as errors |
| `--quiet` | `-q` | boolean | false | Suppress non-error output |
| `--verbose` | `-v` | boolean | false | Include details objects in text output |
| `--version` | | | | Print validator version and exit |

### 7.3 exit codes

| code | meaning |
|---|---|
| 0 | Repository is conformant (and all executions are acceptance-eligible, if checked) |
| 1 | Repository is non-conformant (errors found) |
| 2 | Validator internal error (parse failure, I/O error, schema loading failure) |

### 7.4 text output format

```
BDSK Validator v1.0.0 | Spec v0.3

Repository: /path/to/repo
Artifacts:  47 scanned, 45 valid, 2 errors

Executions:
  EP-001 "Feature X"  ACCEPTED
  EP-002 "Bugfix Y"   REJECTED (2 blocking failures)

Findings (7 total: 3 errors, 4 warnings):
  ERROR   BDSK-REF-001   artifact BS-042: references missing artifact AR-099
  ERROR   BDSK-GATE-001  artifact EP-002: blocking gate RG-005 failed without waiver
  ...

Repository outcome: NON-CONFORMANT
```

## 8. library API

The validator SHOULD also be usable as a library.

### 8.1 primary entry point

```
validate(options: ValidateOptions): Promise<ConformanceReport>
```

### 8.2 ValidateOptions

```
ValidateOptions {
  repositoryPath: string
  artifactsDir?: string         // default: "artifacts/"
  schemasDir?: string           // default: bundled
  configPath?: string           // default: ".bdsk/config.yaml"
  phases?: Phase[]              // default: all
  executionFilter?: string[]    // specific execution plan IDs
  strict?: boolean              // treat warnings as errors
}
```

### 8.3 phase-level APIs

```
discoverArtifacts(path: string, options?): Promise<{index: ArtifactIndex, findings: Finding[]}>
validateSchemas(index: ArtifactIndex, schemas: SchemaMap): Finding[]
validateTraces(index: ArtifactIndex): Finding[]
validateReferentialIntegrity(index: ArtifactIndex): Finding[]
validateAuthority(index: ArtifactIndex, config?: AuthorityConfig): Finding[]
validateExecutionConformance(index: ArtifactIndex): Finding[]
validateVerificationCoverage(index: ArtifactIndex): Finding[]
validateAcceptance(index: ArtifactIndex, priorFindings: Finding[]): Finding[]
```

Each function is independently callable, enabling unit testing of individual phases and use-case-specific validation.

## 9. conformance report schema

The validator MUST emit a machine-readable conformance report matching the structure mandated by the spec:

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

### output semantics

- The validator MUST NOT silently coerce a failing repository into a conformant state.
- The validator MUST report computed outcomes even when a recorded acceptance decision disagrees.
- The validator SHOULD expose both artifact-level and execution-level findings.

## 10. configuration

### 10.1 configuration file

Location: `.bdsk/config.yaml`

```yaml
bdsk_config_version: "1"
artifacts_dir: "artifacts/"
schemas_dir: null                # null = use bundled schemas
file_extensions:
  - ".yaml"
  - ".yml"
  - ".json"
authority:
  behavior_spec_approval:
    - product_authority
    - technical_authority
  assumption_acceptance_product:
    - product_authority
  assumption_acceptance_architecture:
    - technical_authority
  assumption_acceptance_security:
    - security_authority
  codegen_policy_approval:
    - technical_authority
  review_gate_approval:
    - technical_authority
  review_gate_approval_security:
    - technical_authority
    - security_authority
  execution_plan_approval:
    - technical_authority
  waiver_warning_gate:
    - technical_authority
    - qa_authority
  waiver_blocking_security_gate:
    - security_authority
  acceptance_decision:
    - release_authority
  acceptance_decision_production:
    - release_authority
    - qa_authority
  custom_roles: []
ignore_paths:
  - "**/*.draft.yaml"
strict_mode: false
```

### 10.2 authority configuration

The default authority matrix is the one from the spec. Repositories MAY provide a stricter matrix (require more roles for a given action) but MUST NOT weaken the spec defaults. The validator MUST reject a config that attempts to weaken authority requirements.

## 11. testing strategy

### 11.1 unit tests per phase

Each validation phase has a corresponding test suite. Tests use fixture YAML files representing specific error conditions.

### 11.2 fixture design

Each fixture is a minimal BDSK repository (a directory of YAML files) designed to trigger specific findings:

- `conformant/` -- Zero errors, zero warnings. A gold-standard repository with 2 behavior specs, 1 assumption, 1 contract, 1 policy, 2 gates, 1 execution plan, 1 diff, 2 verifications, 2 evals, 1 log, 1 acceptance decision. All traces resolve. All authorities valid. Algorithm E computes `accepted`.
- `missing-refs/` -- Broken `target_id` values. Triggers BDSK-REF-001.
- `bad-schemas/` -- Artifacts missing required fields. Triggers BDSK-SCHEMA-002.
- `duplicate-ids/` -- Two artifacts share the same `id`. Triggers BDSK-SCHEMA-001.
- `bad-traces/` -- Invalid edge types, extra fields, missing upstream/downstream. Triggers BDSK-TRACE-001 through -004.
- `authority-violations/` -- Approvals by wrong roles. Triggers BDSK-AUTH-001 through -004.
- `gate-failures/` -- Blocking gate fails with no waiver. Triggers BDSK-GATE-001.
- `acceptance-mismatch/` -- Recorded outcome is `accepted` but computed outcome is `rejected`. Triggers BDSK-ACC-002.
- `expired-waiver/` -- Waiver's `valid_until` is in the past. Triggers BDSK-WAIVER-002.
- `stop-condition-breach/` -- Execution log shows triggered stop condition with no escalation. Triggers BDSK-EXEC-003.

## 12. reference project structure

```
bdsk-validator/
  src/
    index.ts                     # library entry point
    cli.ts                       # CLI entry point
    config.ts                    # configuration loading

    types/
      artifact.ts                # ParsedArtifact, ArtifactKind, TraceEdge enums
      findings.ts                # Finding, FindingCategory, error code constants
      report.ts                  # ConformanceReport type

    core/
      artifact-index.ts          # ArtifactIndex class with graph traversal
      schema-registry.ts         # JSON Schema loading and lookup by kind
      compatibility-matrix.ts    # edge-kind compatibility static table
      authority-matrix.ts        # default authority requirements

    phases/
      v1-discovery.ts
      v2-schema.ts
      v3-trace.ts
      v4-referential.ts          # RI-1 through RI-10
      v5-authority.ts            # AU-1 through AU-5
      v6-execution.ts            # Algorithms A, B, C
      v7-verification.ts         # Algorithm D
      v8-acceptance.ts           # Algorithm E

    output/
      yaml-reporter.ts
      json-reporter.ts
      text-reporter.ts

  schemas/                       # bundled JSON Schema pack
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

  test/
    fixtures/
      conformant/
      missing-refs/
      bad-schemas/
      duplicate-ids/
      bad-traces/
      authority-violations/
      gate-failures/
      acceptance-mismatch/
      expired-waiver/
      stop-condition-breach/
    phases/
      v1-discovery.test.ts
      v2-schema.test.ts
      v3-trace.test.ts
      v4-referential.test.ts
      v5-authority.test.ts
      v6-execution.test.ts
      v7-verification.test.ts
      v8-acceptance.test.ts
    integration/
      full-pipeline.test.ts
      cli.test.ts
```

## 13. extensibility

### 13.1 future spec versions

The `schema_version: "0.3"` field is checked explicitly. When v0.4 arrives:

- Add new JSON Schemas to the bundled schema pack.
- Add a version-dispatch layer in schema-registry that selects schemas by `schema_version`.
- Add new edge types or artifact kinds to the enumerations.
- Add new RI rules as additional check functions in v4-referential.

### 13.2 custom rules

Repositories may wish to add project-specific validation rules (e.g., "all behavior specs in domain X must have tag Y"). The config can specify custom rule files that are loaded as additional check functions in V4.
