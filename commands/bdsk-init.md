---
name: bdsk-init
description: |
  Initialize BDSK governance in the current repository. Creates the required
  directory structure for artifacts, state tracking, and project configuration.
  Run this once when adopting BDSK in a new project.
allowed-tools:
  - Bash
  - Write
  - Read
  - Glob
  - AskUserQuestion
---

# /bdsk-init

Scaffold the BDSK directory structure in the current repository.

## Process

1. **Check for existing setup.** Glob `artifacts/behaviors/*.yaml`. If artifacts already exist, warn the user: "BDSK artifacts already exist in this repository. Re-initializing will not overwrite them. Continue?"

2. **Create artifact directories.** Run:

```bash
mkdir -p artifacts/behaviors artifacts/assumptions artifacts/contracts artifacts/policies artifacts/gates artifacts/execution-plans artifacts/diffs artifacts/verifications artifacts/execution-evals artifacts/execution-logs artifacts/acceptance artifacts/waivers
```

3. **Create .gitkeep files** in each empty directory so git tracks them:

```bash
for dir in artifacts/behaviors artifacts/assumptions artifacts/contracts artifacts/policies artifacts/gates artifacts/execution-plans artifacts/diffs artifacts/verifications artifacts/execution-evals artifacts/execution-logs artifacts/acceptance artifacts/waivers; do
  touch "$dir/.gitkeep"
done
```

4. **Create state directory:**

```bash
mkdir -p .claude/state/active-executions
touch .claude/state/active-executions/.gitkeep
```

5. **Create governance config.** Write `.bdsk/config.yaml`:

```yaml
# BDSK Governance Configuration
# See: bdsk_specification_v_0.md section 5.5

artifacts_dir: "artifacts/"
file_extensions: [".yaml", ".yml"]
ignore_paths: ["**/*.draft.yaml"]
strict_mode: false

# Authority matrix — maps governance actions to required roles.
# The validator uses these defaults. Uncomment to customize (can only be stricter).
# authority:
#   behavior_spec_approval: [product_authority, technical_authority]
#   assumption_acceptance_product: [product_authority]
#   assumption_acceptance_architecture: [technical_authority]
#   assumption_acceptance_security: [security_authority]
#   codegen_policy_approval: [technical_authority]
#   review_gate_approval: [technical_authority]
#   review_gate_approval_security: [technical_authority, security_authority]
#   execution_plan_approval: [technical_authority]
#   acceptance_decision: [release_authority]
```

If `.bdsk/config.yaml` already exists, do NOT overwrite it.

6. **Create or update .claude/CLAUDE.md.** If `.claude/CLAUDE.md` does not exist, create it with this template:

```markdown
# Project Name

This project uses BDSK governance for AI-assisted development.

## BDSK Lifecycle

All changes follow the BDSK lifecycle:

1. **Discover** - surface behaviors, assumptions, and open questions
2. **Specify** - formalize intended behavior using `/specify`
3. **Constrain** - define execution boundaries using `/plan-execution`
4. **Execute** - implement within approved scope (hooks enforce boundaries)
5. **Evaluate** - check process conformance using `/evaluate`
6. **Verify** - confirm implementation matches specification using `/verify`
7. **Accept** - approve or reject via `/accept`

## Quick Start

- `/run <feature>` - full lifecycle in one command (recommended)
- `/specify <feature>` - generate a behavior spec
- `/assume <statement>` - capture an assumption

## Rules

- All implementation changes must trace to at least one approved behavior_spec
- Assumptions that affect implementation must be captured via `/assume`
- Use `/approve <id>` to approve artifacts before implementation
```

If `.claude/CLAUDE.md` already exists, do NOT overwrite it. Instead, tell the user they may want to add BDSK lifecycle instructions to their existing CLAUDE.md.

7. **Report.** Print summary:

```
BDSK initialized successfully.

Created:
  artifacts/           12 subdirectories for governance artifacts
  .claude/state/       Execution state tracking
  .bdsk/config.yaml    Governance configuration (authority roles, settings)

Next steps:
  1. Run /specify <feature> to create your first behavior spec
  2. Or run /run <feature> for the full lifecycle in one command
  3. Edit .bdsk/config.yaml to customize authority roles if needed
```

## Rules

- Never overwrite existing files or artifacts
- Always create .gitkeep files so empty directories are tracked by git
- If the user's repo already has an artifacts/ directory with non-BDSK content, warn and ask before proceeding
