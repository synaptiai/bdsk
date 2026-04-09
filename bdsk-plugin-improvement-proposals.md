# BDSK Plugin Improvement Proposals

> Based on real-world usage building a Clinical Operations Assistant (50 artifacts, 13 behavior specs, 11 assumptions, 6 review gates, 18 E2E tests). Single session, single developer, full lifecycle twice (initial + remediation).

## Executive Summary

The BDSK plugin v0.3.0 provides a solid governance framework, but our session exposed **systematic artifact generation defects** that consumed more time fixing YAML/schema compliance than building the actual application. Of ~6 hours total session time, roughly 2 hours were spent diagnosing and fixing artifacts that the plugin's own skills generated incorrectly.

The root issues fall into three categories:
1. **Skills generate non-conformant artifacts** (the plugin doesn't follow its own schemas)
2. **Critical information is undocumented** (authority matrix, edge compatibility, status enums)
3. **Scope enforcement has gaps** (blocks governance outputs the lifecycle needs)

---

## Issue 1: Skills Generate Schema-Invalid YAML

**Severity: Critical**

The `/specify`, `/assume`, `/plan-execution`, and `/evaluate` skills generate artifacts that fail the plugin's own validator. We started with **379 schema errors across 50 artifacts** — every single artifact had at least one violation.

### 1a. Approval entries use wrong field names

**What the skills generate:**
```yaml
approvals:
  - approver: Daniel Bentes
    date: "2026-04-09T13:33:14Z"
    decision: approved
```

**What the schema requires:**
```yaml
approvals:
  - authority_role: technical_authority
    approver: Daniel Bentes
    approved_at: "2026-04-09T13:33:14Z"
```

The skills emit `date` instead of `approved_at`, add a non-existent `decision` field, and omit the required `authority_role` entirely. This affected all 50 artifacts.

**Proposed fix:** Update the approval YAML template in every skill that writes approvals (`/approve`, `/specify`, `/assume`, `/plan-execution`, `/evaluate`, `/verify`, `/accept`).

### 1b. Trace entries use bare strings instead of objects

**What the skills generate:**
```yaml
trace:
  downstream:
    - BS-write-tool-hitl-20260409-130618
    - BS-fast-correction-20260409-130618
```

**What the schema requires:**
```yaml
trace:
  downstream:
    - target_id: BS-write-tool-hitl-20260409-130618
      edge: derived_from
```

Every trace entry must be an object with `target_id` and `edge`. The skills emit bare strings for downstream entries in assumptions and some behavior specs.

**Proposed fix:** Update trace entry generation in all skills to always emit `{target_id, edge}` objects.

### 1c. Assumption structure diverges from schema

**What `/assume` generates:**
```yaml
status: approved
metadata:
  tags: [ai-sdk, hitl]
assumption:
  statement: "..."
  source: "..."
  impact: "..."
  risk_if_wrong: "..."
  verification: "..."
```

**What the schema requires:**
```yaml
status: accepted          # not "approved"
metadata:
  impact_level: high      # not tags
  area: architecture      # not tags
spec:                     # not "assumption"
  statement: "..."
  rationale: "..."
  source_type: documented
  source_refs: ["..."]
  decision_authority: "..."
  review_by: "..."
  resolution_rule: "..."
```

The field name is `spec` not `assumption`. The status enum uses `accepted` not `approved`. The metadata requires `impact_level` and `area`, not `tags`. Every single field under `spec` is different from what the skill generates.

**Proposed fix:** Rewrite the `/assume` skill's YAML template to match the assumption_record.json schema exactly.

### 1d. Verification artifact structure diverges from schema

**What `/verify` (and `/run`) generates:**
```yaml
status: completed
metadata:
  verification_type: automated_test
spec:
  subject_behavior: BS-pseudonymization-20260409-130618
  execution_result: pass
  evidence:
    - "10 tests pass"
  test_results:
    - test_file: tests/pseudonymization.test.ts
      tests_run: 10
```

**What the schema requires:**
```yaml
status: approved          # not "completed"
metadata:
  verification_type: integration_test  # not "automated_test"
spec:
  location: "tests/pseudonymization.test.ts"  # required field
  proves:                                      # not "subject_behavior"
    - "BS-pseudonymization-20260409-130618"
  execution_result: pass
  evidence_refs:           # not "evidence"
    - "10 tests pass"
  # no "test_results" field allowed
```

Multiple field renames, wrong status enum, wrong verification_type enum, and extra fields that the schema rejects.

**Proposed fix:** Rewrite the `/verify` skill's YAML template.

### 1e. YAML quoting failures in behavior spec examples

The `/specify` skill generates `given`/`when`/`then` array values with bare colons, curly braces, and brackets:

```yaml
then:
  - "Needs Action" section contains 1 item: Michael Reed
  - The tool returns { success: false, error: "conflict" }
```

YAML parses the colon as a mapping key and the braces as flow mappings, breaking the file. These need to be quoted strings.

**Proposed fix:** The `/specify` skill should always wrap example values in quotes if they contain `:`, `{`, `}`, `[`, or `]`.

---

## Issue 2: Authority Matrix is Undocumented and Invisible

**Severity: High**

The validator enforces a fixed authority matrix that maps actions to role names:

| Action | Required Role |
|--------|--------------|
| behavior_spec_approval | product_authority OR technical_authority |
| assumption_acceptance_architecture | technical_authority |
| assumption_acceptance_security | security_authority |
| review_gate_approval | technical_authority |
| acceptance_decision | release_authority |

But the skills don't know about this matrix. The `/approve` skill infers `authority_role` values like `spec_approver`, `gate_approver`, or the action name itself (`behavior_spec_approval`). None of these are valid role names.

The actual role names (`product_authority`, `technical_authority`, `security_authority`, `release_authority`, `qa_authority`) are hardcoded in `authority-matrix.js` but never surfaced to the skills.

**Impact:** Every approved artifact fails AUTH-001 validation until the authority_role is manually corrected.

**Proposed fix:**
1. The `/approve` skill should read the authority matrix and use the correct role names.
2. Document the authority matrix in the skill descriptions or in a project-level config file.
3. Consider allowing a `.bdsk/config.yaml` where the user maps their name to roles (e.g., "Daniel Bentes has technical_authority, product_authority, release_authority").

---

## Issue 3: Edge-Kind Compatibility Matrix is Undocumented

**Severity: High**

The validator enforces a strict compatibility matrix for trace edges between artifact kinds. For example:
- `verification_artifact` can only trace upstream to `behavior_spec` via `proves` or `generated_diff` via `depends_on`
- `acceptance_decision` can only trace upstream to `generated_diff`, `verification_artifact`, `execution_eval`, or `waiver_record`

But the skills have no knowledge of this matrix. The `/run` skill writes `edge: depends_on` for every upstream trace regardless of artifact kind pairs. This causes TRACE-004 errors for nearly every cross-reference.

The matrix exists only in `compatibility-matrix.js` — 38 lines of `allow()` calls — and is not documented anywhere the skills can reference.

**Impact:** We had 30+ trace compatibility errors that required reading the validator source code to fix.

**Proposed fix:**
1. Document the compatibility matrix in the skill descriptions.
2. Better: have each skill consult the matrix when writing trace entries, selecting the correct edge type automatically.
3. Best: ship a `.bdsk/trace-guide.md` or embed the matrix in the `/specify` and `/plan-execution` skill prompts.

---

## Issue 4: Scope Hook Blocks Governance Outputs

**Severity: High**

The `check-scope.sh` hook whitelists governance output paths:
- `artifacts/verifications/` 
- `artifacts/execution-evals/`
- `artifacts/acceptance/`
- `artifacts/execution-logs/`
- `.claude/state/`

But `artifacts/diffs/` is NOT whitelisted. The `/run` skill explicitly says to create `generated_diff` artifacts in `artifacts/diffs/`, but the scope hook blocks the write because it's not in `in_scope_paths`.

**Impact:** We could never create the `generated_diff` artifact, which caused:
- ACC-001 errors ("Acceptance recorded without subject_diffs")
- REF-005 errors (generated diff missing traces)
- Incomplete audit trail

**Proposed fix:** Add `artifacts/diffs/` to the whitelist in `check-scope.sh`. This is clearly a governance output path that the lifecycle needs.

---

## Issue 5: No Execution Log Artifact Created

**Severity: Medium**

The validator warns about missing `execution_log` artifacts (BDSK-EXEC-004), but no skill creates them. The `/run` skill tracks phase progress in `.claude/state/active-executions/` but never creates a proper `execution_log` artifact in `artifacts/execution-logs/`.

The `execution_log` schema expects:
```yaml
kind: execution_log
spec:
  phase: implement
  actions: [...]
  stop_conditions_triggered: []
  final_state: completed
```

**Impact:** EXEC-004 warning on every validation run. Missing audit evidence for execution phase.

**Proposed fix:** The `/run` skill should create an `execution_log` artifact at the end of the IMPLEMENT phase (or at the end of each phase transition), summarizing what actions were taken.

---

## Issue 6: Validator Dependency Installation

**Severity: Medium**

The BDSK validator CLI requires `yaml` and `ajv` npm packages, but these aren't installed in the plugin's `node_modules`. Running the validator fails with `ERR_MODULE_NOT_FOUND` until the user manually runs `npm install yaml ajv` in the plugin directory.

**Proposed fix:** Include `yaml` and `ajv` as bundled dependencies in the plugin distribution, or have the `/validate` skill auto-install them.

---

## Issue 7: Status Enum Confusion

**Severity: Medium**

Different artifact kinds use different status enums, and the skills don't always use the right one:

| Kind | Skill Generates | Schema Requires |
|------|----------------|-----------------|
| assumption_record | `approved` | `accepted` |
| verification_artifact | `completed` | `approved` |
| behavior_spec | `approved` | `approved` (correct) |

The skills treat "approved" as a universal status, but assumption_records use `accepted` and verifications don't have a `completed` status.

**Proposed fix:** Each skill should reference the correct status enum for the artifact kind it creates. A shared constant or lookup would prevent this.

---

## Issue 8: Review Gate Schema Gaps in `/plan-execution`

**Severity: Medium**

The `/plan-execution` skill creates review gate artifacts with a minimal structure:

```yaml
spec:
  evaluation_method: diff_analysis
  pass_condition: "All changes within approved scope"
  failure_action: "Block until scope is fixed"
```

But the schema requires:
```yaml
spec:
  description: "..."              # missing
  applies_when: ["..."]           # missing
  evaluation_method: diff_analysis
  pass_condition: ["..."]         # must be array, not string
  fail_action: block              # must be enum, not free text
  evidence_required: ["..."]      # missing
```

Five required fields are missing, `pass_condition` is a string instead of an array, and `fail_action` uses free text instead of the enum (`block|warn|require_manual_review|escalate`). The skill also uses `failure_action` (wrong field name) instead of `fail_action`.

**Proposed fix:** Update the review gate template in `/plan-execution` to include all required fields with correct types.

---

## Issue 9: `/run` Doesn't Validate Before Accepting

**Severity: Medium**

The `/run` lifecycle goes: implement → evaluate → verify → validate → accept. But the validate phase often reveals schema errors in artifacts that the EARLIER phases just created. By the time validation catches the errors, the artifacts are already committed.

In our session, the first `/run` completed with acceptance, then the validator revealed 379 errors in the accepted artifacts. The acceptance was premature.

**Proposed fix:** 
1. Run a lightweight schema validation after each artifact-creating phase (not just at the end).
2. Alternatively, have each skill validate its output against the JSON schema before writing to disk.

---

## Issue 10: Specification Depth Guidance

**Severity: Medium**

The `/specify` skill generates behavior specs, but for SDK integrations it doesn't push for API contract depth. Our initial specs said things like "the approval flow works" without specifying:
- Exact method signatures (`addToolApprovalResponse({id, approved, reason})`)
- Exact state enum values (`"approval-requested"` not `"approval-required"`)
- Exact data formats (`chunk.delta` not `chunk.textDelta`)

This led to 4 critical bugs that unit tests missed but E2E browser testing caught.

**Proposed fix:**
1. The `/specify` skill should prompt for API contract detail when the behavior involves third-party SDK integration.
2. Consider auto-generating a linked `contract_artifact` when assumptions reference external APIs.
3. The `/assume` skill should flag SDK version assumptions as `impact_level: high` by default.

---

## Issue 11: E2E Testing Not Part of Default Gate Set

**Severity: Medium**

The initial `/run` created 5 review gates (scope compliance, schema integrity, PII leak prevention, test coverage, pseudonymization roundtrip) but none for E2E browser testing. All unit tests passed while 9 critical UI issues went undetected.

**Proposed fix:**
1. When the behavior specs describe UI interactions, the `/plan-execution` skill should auto-suggest an E2E testing review gate.
2. Consider a default gate template that includes E2E testing for web applications.

---

## Issue 12: Scope Expansion During Remediation

**Severity: Low**

When we needed to add Playwright E2E tests during remediation, `playwright.config.ts` wasn't in the execution plan's `in_scope_paths`. But we couldn't edit the execution plan because `artifacts/execution-plans/**` was in `out_of_scope_paths`.

The workaround was putting the Playwright config inside `tests/e2e/` (which was in scope). But this is a governance deadlock — you can't expand scope without editing the plan, and you can't edit the plan because it's out of scope.

**Proposed fix:**
1. The `/run --from plan` resume should allow re-scoping (create a new plan version).
2. Or provide a `/rescope` skill that creates an amendment to the execution plan.
3. At minimum, the plan's `in_scope_paths` should include common config files like `*.config.ts` at the root.

---

## Issue 13: Acceptance Decision Without Generated Diff

**Severity: Low**

Because the scope hook blocked `artifacts/diffs/` (Issue 4), the acceptance decisions have empty `subject_diffs` arrays. This causes ACC-001 errors that can't be resolved without the diff artifact.

The `/accept` skill should either:
1. Create the generated_diff itself (it has access to `git diff`)
2. Skip the subject_diffs requirement if no diffs exist (with a warning)
3. Reference the execution plan instead

**This is downstream of Issue 4** — fixing the scope whitelist would resolve this.

---

## Issue 14: No Built-in Schema Self-Test

**Severity: Low**

There's no way to validate a single artifact file against its schema before committing. The validator always scans the entire repository. A quick `bdsk validate artifacts/behaviors/BS-foo.yaml` command would catch issues immediately.

**Proposed fix:** Add a `--file` flag to the validator CLI for single-file validation.

---

## Prioritized Recommendations

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| P0 | #1 Skills generate non-conformant YAML | 379 errors, ~2hrs to fix | Medium (template updates) |
| P0 | #2 Authority matrix undocumented | 31 AUTH errors | Low (add to skill prompts) |
| P0 | #4 Scope hook blocks diffs/ | Can't create required artifact | Trivial (1-line fix) |
| P1 | #3 Edge compatibility undocumented | 30+ TRACE errors | Low (add to skill prompts) |
| P1 | #7 Status enum confusion | Wrong status on every artifact | Low (lookup table) |
| P1 | #8 Review gate template incomplete | 5 missing fields per gate | Low (template fix) |
| P1 | #9 Validate before accept | Premature acceptance | Medium (add pre-validation) |
| P2 | #5 No execution log created | EXEC-004 warning | Medium (new artifact creation) |
| P2 | #6 Validator dependency installation | Validator crashes on first run | Trivial (bundle deps) |
| P2 | #10 Spec depth for SDK integrations | 4 critical bugs missed | Medium (prompt engineering) |
| P2 | #11 E2E testing not default gate | 9 issues missed | Low (gate template) |
| P3 | #12 Scope expansion deadlock | Manual workaround needed | Medium (new skill) |
| P3 | #13 Acceptance without diffs | ACC-001 errors | Downstream of #4 |
| P3 | #14 No single-file validation | Slow feedback loop | Low (CLI flag) |

---

## Quantitative Impact

| Metric | Value |
|--------|-------|
| Total artifacts generated | 50 |
| Artifacts with schema errors | 50 (100%) |
| Total schema errors | 379 |
| Time spent fixing artifacts | ~2 hours |
| Fix iterations required | 6 rounds of validate-fix-validate |
| Errors from wrong approval format | ~150 (3 per artifact) |
| Errors from wrong trace format | ~60 |
| Errors from wrong authority roles | ~40 |
| Errors from YAML quoting | ~30 |
| Errors from wrong field names | ~50 |
| Errors from wrong status enums | ~20 |
| Errors from edge incompatibility | ~30 |

---

## Conclusion

The BDSK governance model is sound — the 8-phase validator catches real issues, the scope enforcement prevents drift, and the authority matrix enforces accountability. But the skills that GENERATE artifacts don't follow the same rules the validator ENFORCES. This creates a frustrating experience where the framework fights itself.

The single highest-impact change would be: **make each skill validate its output against the JSON schema before writing to disk.** This would catch 95% of the issues at creation time instead of after a full lifecycle run.
