# BDSK Project

BDSK is a specification-first governance system for AI-assisted code generation. It encodes coordination into machine-enforceable infrastructure so humans can focus on specification.

## Specification

The authoritative spec is `bdsk_specification_v_0.md` (v0.3). JSON schemas are in `schemas/`. The validator architecture is in `validator-spec.md`.

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

- `/specify <feature>` - generate a behavior_spec artifact with concrete examples
- `/assume <statement>` - capture an assumption as a structured record
- `/plan-execution` - generate an execution plan from approved specs
- `/validate` - check all artifacts for schema validity, trace integrity, and coverage
- `/accept` - compute acceptance eligibility per Algorithm E

## Rules

- Never modify `bdsk_specification_v_0.md` without an approved behavior_spec governing the change
- Never modify `schemas/*.json` without an approved behavior_spec and execution_plan
- All implementation changes must trace to at least one approved behavior_spec
- Assumptions that affect implementation must be captured via `/assume`

## Artifacts

BDSK artifacts live in `artifacts/` organized by type. Artifacts are YAML files following the canonical envelope from the spec. AI generates all artifacts; humans review and approve by changing status from `draft` to `approved`.

## Testing

Run hook tests: `bash test/test-hooks.sh`
Validate schemas: `python3 -c "import json; [json.load(open(f'schemas/{f}')) for f in __import__('os').listdir('schemas')]"`
