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
- `/evaluate` - assess review gates, create execution_eval artifacts
- `/verify` - run tests, create verification_artifact for each behavior spec
- `/validate` - run full 8-phase validator (V1-V8) or lightweight fallback
- `/accept` - compute acceptance eligibility per Algorithm E

## Rules

- Never modify `bdsk_specification_v_0.md` without an approved behavior_spec governing the change
- Never modify `schemas/*.json` without an approved behavior_spec and execution_plan
- All implementation changes must trace to at least one approved behavior_spec
- Assumptions that affect implementation must be captured via `/assume`

## Artifacts

BDSK artifacts live in `artifacts/` organized by type. Artifacts are YAML files following the canonical envelope from the spec. AI generates all artifacts; humans review and approve using `/approve <id>` (or `/approve --plan <id>` for cascading approval).

## Testing

Run hook tests: `bash test/test-hooks.sh`
Run validator: `node dist/cli.js . --format text --verbose --schemas-dir schemas`
Build validator: `bun run build`
