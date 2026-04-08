# **Behavior-Driven Specification Kit**

**Behavior-Driven Specification Kit** (BDSK) — is a specification-first governance system for AI-assisted code generation.

## Overview

BDSK defines a method for AI-assisted software development that uses behavior-driven specifications, explicit assumptions, concrete examples, and execution-phase governance to reduce ambiguity before code generation and to constrain how AI agents produce code.

Traditional BDD improves shared understanding between humans. BDSK extends that idea for AI: specifications are not only communication artifacts — they are **execution constraints** for AI-assisted implementation. Every change traces to an approved spec, every assumption is captured as a first-class artifact, and an 8-phase validator enforces conformance.

BDSK is not a runtime architecture, agent framework, or testing library. It is a governance system for the phase where humans and AI collaborate to design and generate software.

## Why BDSK

BDSK solves a specific class of problems in AI-assisted development:

1. **AI generates plausible but incorrect implementations** — specs alone don't prevent wrong answers
2. **AI invents APIs and dependencies** — without grounding, AI introduces undocumented behavior
3. **Vague requirements hide assumptions** — ambiguity gets buried in prompts and chat history
4. **Test suites arrive too late** — incorrect design choices are already embedded before testing
5. **Uncertainties are lost** — important decisions remain implicit in conversations
6. **No audit trail for AI execution** — teams can't inspect whether AI stayed within approved scope

## Using BDSK in Your Project

### Install as a Claude Code plugin

```bash
claude plugin add github:synaptiai/bdsk
```

### Initialize your repository

After installing the plugin, run the init command in your project:

```
/bdsk-init
```

This creates the required directory structure:
- `artifacts/` — 12 subdirectories for governance artifacts
- `.claude/state/` — execution state tracking
- `.claude/CLAUDE.md` — project context template

### Start using BDSK

Use `/run` for the full lifecycle in one command:

```
/run <feature description>
```

This chains: specify → plan → implement → evaluate → verify → validate → accept. Only two human gates (spec review, scope review) — everything else is automatic.

Or use individual skills: `/specify`, `/plan-execution`, `/evaluate`, `/verify`, `/validate`, `/accept`.

### Prerequisites

- [Node.js](https://nodejs.org) (v18+) — runs the bundled validator
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Python 3 with PyYAML (optional — for scope enforcement hooks)

## The Lifecycle

All changes follow a 7-phase lifecycle:

```
  Discover ──► Specify ──► Constrain ──► Execute ──► Evaluate ──► Verify ──► Accept
                 ▲            ▲                         │           │          │
              human         human                    auto        auto       auto
              gate          gate                  (escalate   (escalate  (escalate
                                                  on fail)    on fail)   on fail)
```


| Phase        | Action                                                     | Skill             | Output                  |
| ------------ | ---------------------------------------------------------- | ----------------- | ----------------------- |
| 1. Discover  | Surface behaviors, assumptions, open questions             | —                 | —                       |
| 2. Specify   | Formalize intended behavior with concrete examples         | `/specify`        | `behavior_spec`         |
| 3. Constrain | Define execution boundaries and allowed operations         | `/plan-execution` | `execution_plan`        |
| 4. Execute   | Implement within approved scope (hooks enforce boundaries) | —                 | `generated_diff`        |
| 5. Evaluate  | Check process conformance against review gates             | `/evaluate`       | `execution_eval`        |
| 6. Verify    | Confirm implementation matches specification via tests     | `/verify`         | `verification_artifact` |
| 7. Accept    | Approve or reject per Algorithm E                          | `/accept`         | `acceptance_decision`   |


Humans approve the **what** (specification and scope). The system handles the **how**.

## Artifact Types

BDSK uses 11 artifact types, stored as YAML in `artifacts/`:


| Kind                    | Prefix | Directory          | Purpose                                             |
| ----------------------- | ------ | ------------------ | --------------------------------------------------- |
| `behavior_spec`         | BS     | `behaviors/`       | Observable expected behavior with concrete examples |
| `assumption_record`     | AR     | `assumptions/`     | Decisions or beliefs affecting implementation       |
| `contract_artifact`     | CA     | `contracts/`       | API contracts, schemas, and boundaries              |
| `codegen_policy`        | CP     | `policies/`        | Rules governing AI code generation                  |
| `review_gate`           | RG     | `gates/`           | Review checkpoints code must pass                   |
| `execution_plan`        | EP     | `execution-plans/` | Approved scope, boundaries, allowed operations      |
| `generated_diff`        | GD     | `diffs/`           | Code changes produced during execution              |
| `execution_eval`        | EE     | `execution-evals/` | Process conformance assessment results              |
| `execution_log`         | EL     | `execution-logs/`  | Step-by-step execution audit trail                  |
| `verification_artifact` | VA     | `verifications/`   | Test results proving spec conformance               |
| `acceptance_decision`   | AD     | `acceptance/`      | Final accept/reject decision                        |


All artifacts follow the canonical envelope defined in the spec, with `kind`, `id`, `status`, `trace`, `approvals`, and `spec` fields.

## Skills

Lifecycle commands available in Claude Code:


| Command               | Description                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| `/bdsk-init`          | Initialize BDSK in a repository (create `artifacts/`, state dirs, CLAUDE.md)     |
| `/run <feature>`      | Full lifecycle in one command (2 human gates, rest automatic)                    |
| `/specify <feature>`  | Generate a `behavior_spec` with concrete given/when/then examples                |
| `/assume <statement>` | Capture an assumption as a structured `assumption_record`                        |
| `/plan-execution`     | Generate an `execution_plan` with scope boundaries from approved specs           |
| `/approve <id>`       | Approve artifacts (single, batch with `--all-draft`, or cascading with `--plan`) |
| `/evaluate`           | Assess review gates, create `execution_eval` artifacts                           |
| `/verify`             | Run tests, create `verification_artifact` for each behavior spec                 |
| `/validate`           | Run the full 8-phase validator (V1–V8)                                           |
| `/accept`             | Compute acceptance eligibility per Algorithm E                                   |


## Validator

The reference validator runs 8 phases of conformance checking:


| Phase | Name         | Checks                                                       |
| ----- | ------------ | ------------------------------------------------------------ |
| V1    | Discovery    | Find all YAML artifacts, build index, detect duplicate IDs   |
| V2    | Schema       | Validate each artifact against its JSON schema               |
| V3    | Trace        | Validate trace structures and canonical edge vocabulary      |
| V4    | Referential  | Check that all referenced `target_id`s exist                 |
| V5    | Authority    | Enforce approval rules, waivers, and authority matrix        |
| V6    | Execution    | Verify AI stayed within approved boundaries (Algorithms A–C) |
| V7    | Verification | Check test coverage aligns with behavior specs (Algorithm D) |
| V8    | Acceptance   | Compute acceptance decisions (Algorithm E)                   |


### CLI Usage

```bash
bdsk-validate <path> [options]

Options:
  -f, --format <text|yaml|json>   Output format (default: text)
  -o, --output <file>             Write report to file
  -a, --artifacts-dir <path>      Artifacts directory (default: artifacts/)
  -s, --schemas-dir <path>        Schemas directory (default: schemas/)
  -p, --phase <v1-v8|all>         Run specific phase (default: all)
  -e, --execution <id>            Filter to specific execution plan
      --strict                    Treat warnings as errors
      --quiet                     Suppress non-error output
      --verbose                   Show detailed output
      --version                   Show validator version
```

**Exit codes:** `0` conformant, `1` non-conformant, `2` error.

## Project Structure

```
bdsk/                               # Plugin root (installable via Claude Code)
├── .claude-plugin/
│   └── plugin.json                 # Plugin manifest
├── skills/                         # 9 lifecycle skills
│   ├── run/                        #   Full lifecycle orchestrator
│   │   ├── SKILL.md
│   │   └── references/             #   Governance principles
│   ├── specify/SKILL.md            #   Generate behavior specs
│   ├── assume/SKILL.md             #   Capture assumptions
│   ├── plan-execution/SKILL.md     #   Define execution scope
│   ├── approve/SKILL.md            #   Approve artifacts
│   ├── evaluate/SKILL.md           #   Evaluate review gates
│   ├── verify/SKILL.md             #   Run tests, create verification artifacts
│   ├── validate/SKILL.md           #   Run 8-phase validator
│   └── accept/SKILL.md             #   Compute acceptance per Algorithm E
├── commands/
│   └── bdsk-init.md                # Initialize BDSK in a repository
├── hooks/                          # Scope enforcement and audit logging
│   ├── hooks.json                  #   Hook configuration (auto-discovered)
│   ├── run-hook.cmd                #   Cross-platform polyglot wrapper
│   ├── check-scope.sh              #   Blocks edits outside execution scope
│   └── log-change.sh               #   Logs all file changes
├── schemas/                        # JSON schemas for all 11 artifact types
├── src/                            # Validator source (TypeScript)
├── dist/                           # Pre-compiled validator (Node.js)
├── bdsk_specification_v_0.md       # Authoritative BDSK v0.3 specification
├── test/                           # Test fixtures and integration tests
├── artifacts/                      # This repo's own governance artifacts
├── LICENSE                         # MIT
└── package.json                    # Validator dependencies (AJV, YAML)
```

## Governance Principles

1. **Concrete example primacy** — prefer explicit examples over abstract descriptions
2. **Behavior before implementation** — specs precede code; use `/specify` first
3. **Explicit assumptions** — capture decisions as first-class artifacts via `/assume`
4. **Grounding before generation** — no external interfaces without approved basis
5. **Observable verification** — behavior must be verifiable through tests or checks
6. **Boundary discipline** — AI stays within `execution_plan` scope (enforced by hooks)
7. **Human approval at ambiguity** — uncertainty triggers escalation, not silent choices
8. **Traceability over intuition** — every change traces to approved inputs via `trace.upstream`

## Development

```bash
# Install dependencies
bun install

# Build validator (compiles src/ → dist/)
bun run build

# Watch mode
bun run dev

# Run tests
bun test

# Type check
bun run lint

# Run hook tests
bash test/test-hooks.sh

# Run validator directly
node dist/cli.js . --format text --verbose --schemas-dir schemas
```

## Status

BDSK specification v0.3 (draft). Validator v0.1.0.

See [`bdsk_specification_v_0.md`](bdsk_specification_v_0.md) for the full specification.

## License

MIT