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

5. **Create or update .claude/CLAUDE.md.** If `.claude/CLAUDE.md` does not exist, create it with this template:

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

6. **Report.** Print summary:

```
BDSK initialized successfully.

Created:
  artifacts/           12 subdirectories for governance artifacts
  .claude/state/       Execution state tracking

Next steps:
  1. Run /specify <feature> to create your first behavior spec
  2. Or run /run <feature> for the full lifecycle in one command
```

## Rules

- Never overwrite existing files or artifacts
- Always create .gitkeep files so empty directories are tracked by git
- If the user's repo already has an artifacts/ directory with non-BDSK content, warn and ask before proceeding
