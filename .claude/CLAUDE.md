# BDSK Project

BDSK is a specification-first governance system for AI-assisted code generation. It encodes coordination into machine-enforceable infrastructure so humans can focus on specification.

## Specification

The authoritative spec is `bdsk_specification_v_0.md` (v0.3). JSON schemas are in `schemas/`. This repo is also a Claude Code plugin — skills are in `skills/`, hooks in `hooks/`, and the compiled validator in `dist/`.

## BDSK Lifecycle

All changes in this repo follow the BDSK lifecycle:

1. **Discover** - surface behaviors, assumptions, and open questions
2. **Specify** - formalize intended behavior using `/specify`
3. **Constrain** - define execution boundaries using `/plan-execution`
4. **Execute** - implement within approved scope (hooks enforce boundaries)
5. **Evaluate** - check process conformance
6. **Verify** - confirm implementation matches specification
7. **Accept** - approve or reject via `/accept`

## Available Skills

### Lifecycle (use `/run` for the full pipeline)
- `/run <feature>` - **full lifecycle in one command**: specify → plan → implement → evaluate → verify → validate → accept. Only 2 human gates (spec review, scope review); everything else automatic.
- `/specify <feature>` - generate a behavior_spec artifact with concrete examples
- `/assume <statement>` - capture an assumption as a structured record
- `/plan-execution` - generate an execution plan from approved specs
- `/approve <id|pattern>` - approve artifacts in one command (single, batch, or cascading)
- `/gate <description>` - create a review_gate artifact defining a quality/security checkpoint
- `/evaluate` - assess review gates, create execution_eval artifacts
- `/verify` - run tests, create verification_artifact for each behavior spec
- `/validate` - run full 8-phase validator (V1-V8) or lightweight fallback
- `/accept` - compute acceptance eligibility per Algorithm E
- `/rescope <paths>` - amend an active execution plan's scope with human approval

## Rules

- Never modify `bdsk_specification_v_0.md` without an approved behavior_spec governing the change
- Never modify `schemas/*.json` without an approved behavior_spec and execution_plan
- All implementation changes must trace to at least one approved behavior_spec
- Assumptions that affect implementation must be captured via `/assume`

## Artifacts

BDSK artifacts live in `artifacts/` organized by type. Artifacts are YAML files following the canonical envelope from the spec. AI generates all artifacts; humans review and approve using `/approve <id>` (or `/approve --plan <id>` for cascading approval).

## Edge-Kind Compatibility (Quick Reference)

The validator (V3, BDSK-TRACE-004) enforces which edge types are valid between artifact kinds. Using the wrong edge causes validation errors.

| Source Kind | Valid Upstream Edges → Target Kinds |
|---|---|
| behavior_spec | `derived_from` → behavior_spec, assumption_record; `depends_on` → assumption_record, contract_artifact |
| assumption_record | `derived_from` → behavior_spec, assumption_record, contract_artifact |
| review_gate | `depends_on` → codegen_policy, behavior_spec |
| execution_plan | `depends_on` → behavior_spec, assumption_record, contract_artifact, codegen_policy, review_gate |
| generated_diff | `produced_by` → execution_plan; `implements` → behavior_spec; `depends_on` → assumption_record, contract_artifact |
| verification_artifact | `proves` → behavior_spec, contract_artifact; `depends_on` → generated_diff |
| execution_eval | `depends_on` → execution_plan, review_gate, execution_log; `evaluates` → generated_diff |
| execution_log | `depends_on` → execution_plan |
| acceptance_decision | `depends_on` → generated_diff, verification_artifact, execution_eval, waiver_record |
| waiver_record | `waives` → review_gate; `depends_on` → execution_plan, generated_diff |

Common mistakes: using `evaluates` instead of `depends_on` for EE→EP links; using `verifies` (not a valid edge); linking AD→EP (not in compatibility matrix).

## Authority Roles

5 canonical roles used in approvals: `product_authority`, `technical_authority`, `security_authority`, `release_authority`, `qa_authority`.

The validator (V5, BDSK-AUTH-001) checks that approved artifacts have the correct authority role. Projects can customize via `.bdsk/config.yaml` (can only be stricter than defaults). See `src/core/authority-matrix.ts` for the full mapping.

## Testing

Run hook tests: `bash test/test-hooks.sh`
Run validator: `node dist/cli.bundle.js . --format text --verbose --schemas-dir schemas` (fall back to `dist/cli.js` if bundle missing)
Build validator: `bun run build` (compiles TypeScript + bundles zero-dependency validators)
