# BDSK v0.3 Coherence Analysis and Claude Code Applicability

## 1. specification coherence: critical findings

### 1.1 the bootstrap problem (CRITICAL)

The specification has no defined entry point. To start an execution, you need an approved behavior spec (line 715). To get a behavior spec, you need upstream artifacts to trace to. But no artifact type exists for discovery output, and the authority model doesn't cover how the first behavior spec gets approved from nothing.

The contract_artifact is the only type with an explicitly empty upstream array (line 325), making it the only artifact that can exist without prior artifacts. But behavior specs trace `derived_from` discovery artifacts -- a concept the spec references but never defines as an artifact kind.

**Consequence**: A team cannot bootstrap a BDSK repository without either (a) violating trace rules or (b) creating artifacts with empty upstream traces that the spec doesn't explicitly permit.

**Recommended fix**: Either define a `discovery_record` artifact kind as the root of the trace graph, or add an explicit rule that behavior specs and assumption records MAY have empty upstream traces when they represent initial specification work.

### 1.2 bidirectional trace inconsistencies (HIGH)

The trace model has multiple semantic inconsistencies where the same relationship is described with different or contradictory edges depending on which side you read from:

**behavior_spec <-> verification_artifact**: Both use `proves` in opposite directions. behavior_spec's downstream says verification traces with `proves`; verification_artifact's upstream also says `proves` pointing back to behavior. Per TR-5, the source artifact contains the trace -- so both claim to be the "prover." The correct reading: verification_artifact proves behavior_spec. The behavior_spec's downstream should use a different edge or the spec should clarify that downstream edges describe the relationship FROM the target's perspective.

**execution_plan <-> execution_eval**: execution_plan downstream says `evaluates` to execution_eval; execution_eval upstream says `depends_on` to execution_plan. These are not reciprocal.

**generated_diff <-> verification_artifact**: generated_diff downstream says `proves` to verification; verification upstream says `depends_on` to diff.

**contract_artifact downstream**: Uses `proves` edge to verification_artifact, but contracts don't prove anything -- verifications prove contracts. Should be `constrains`.

**Missing rule**: The spec never requires bidirectional consistency. Artifact A can claim a relationship to B that B doesn't reciprocate. This violates the traceability principle (principle 8) and makes graph traversal unreliable.

**Consequence**: A validator implementing the edge-kind compatibility matrix from the spec will either be overly strict (rejecting valid but inconsistently-traced artifacts) or overly permissive (accepting traces that don't reflect real relationships).

**Recommended fix**: Add a trace normalization rule TR-6 requiring that if artifact A's upstream references B with edge X, then B's downstream SHOULD reference A with a consistent reciprocal edge. Define the canonical reciprocal pairs.

### 1.3 authority recording gap (CRITICAL)

The canonical envelope has `owners: [<role or person>]` -- an array of strings. There is no field to record:

- Who approved the artifact (vs. who created it)
- What authority role they acted under
- When the approval happened (only `updated_at` exists, which can change for non-approval reasons)

AU-1 says artifacts SHOULD record the authority role used for approval. AU-5 says acceptance decisions MUST identify approvers and their roles. But the envelope provides no structured field for this.

The acceptance_decision is the only artifact with `spec.approvers` (line 656). Every other artifact has no way to record approval authority.

**Consequence**: A validator cannot enforce the authority matrix because it cannot determine who approved what in what role. The authority validation phase (V5) is unimplementable as specified.

**Recommended fix**: Add an `approvals` field to the canonical envelope:

```yaml
approvals:
  - authority_role: <role>
    approver: <person>
    approved_at: <ISO-8601 timestamp>
```

### 1.4 undefined status transitions (HIGH)

No artifact type defines a state machine. The spec lists valid statuses but never says which transitions are legal:

- Can an execution_plan go from `approved` to `aborted` without passing through `completed`? (Implied yes, but not stated.)
- Can an assumption_record go from `rejected` back to `accepted`? (Unknown.)
- What triggers `expired` on an assumption_record? The `review_by` field exists but no rule says what happens when the date passes.
- Can a verification_artifact go from `approved` to `obsolete`? What triggers this?
- acceptance_decision has only `recorded` and `superseded` but its `metadata.outcome` can be `accepted`, `rejected`, or `conditionally_accepted`. The status and outcome spaces are orthogonal, which is confusing.

**Consequence**: Implementations will make different assumptions about valid transitions, leading to interoperability problems.

**Recommended fix**: Define a state machine for each artifact kind, even if some transitions are permissive. At minimum, define which statuses are terminal (no further transitions allowed).

### 1.5 "rule id" in waivers is undefined (CRITICAL)

waiver_record.spec.waived_target is documented as "gate id or rule id" (line 617). Gates have artifact IDs. Rules (RI-1 through RI-10, AU-1 through AU-5, TR-1 through TR-5) do NOT have artifact IDs -- they are meta-level constraints in the spec text.

**Consequence**: A waiver cannot validly reference a rule because rules aren't in the artifact index. RI-7 says "a waiver record MUST point to an existing waivable target" -- but a rule ID will fail RI-1 (referenced artifact existence).

**Recommended fix**: Either (a) assign canonical IDs to rules (e.g., `bdsk:rule:RI-4`) and exempt them from RI-1, or (b) change the waiver model to only target review gates and remove "rule id" from the spec.

### 1.6 grounding is operationally undefined (HIGH)

Principle 4 says AI must not introduce ungrounded interfaces or behavior claims. The glossary defines grounding sources as "documentation, standards, existing code, or an accepted decision artifact." But the spec never operationally defines:

- Does existing code in the repository count as grounded without a BDSK artifact?
- Can a behavior spec imply an interface (e.g., "REST API") that doesn't have a contract artifact yet?
- What about well-known standards (HTTP, JSON, SQL) -- must each be recorded as a contract?

There is no artifact type for external standards or documentation references. A behavior spec grounded in an RFC or OWASP guideline has no way to record that grounding in the trace model.

**Recommended fix**: Either (a) define that repository code and well-known standards are implicitly grounded, or (b) add a `reference_artifact` kind for external sources.

### 1.7 incomplete authority matrix (HIGH)

The authority matrix (lines 819-831) covers behavior specs, assumptions, codegen policies, review gates, execution plans, waivers, and acceptance decisions. It does NOT cover:

- contract_artifact (has `approved` status but no approval authority)
- generated_diff (has `verified` status but no verification authority)
- verification_artifact (has `approved` status but no approval authority)
- execution_eval (has `completed` status but no authority)
- execution_log (has `completed` status but no authority)

**Recommended fix**: Extend the authority matrix to all artifact types with approval-like statuses.

### 1.8 algorithm E and partial repositories (MEDIUM)

Algorithm E assumes all referenced artifacts exist. If an execution_plan references a behavior spec that isn't in the repository, the algorithm doesn't define the outcome. The spec says the outcome should be `indeterminate` (conformance report, line 1188) but doesn't define when to use it.

**Recommended fix**: Define that Algorithm E MUST return `indeterminate` if any required transitive dependency is unresolvable, and that `indeterminate` is distinct from `rejected`.

### 1.9 verification vs. execution eval separation (MEDIUM)

The spec requires logical separation (line 694) but doesn't address dual-purpose evidence. A test that checks implementation correctness AND detects out-of-scope changes serves both purposes. The spec provides no guidance on how to classify or tag such evidence.

**Recommended fix**: Allow evidence_refs to appear in both verification_artifact and execution_eval, with a documented acknowledgment that the same evidence can satisfy both categories as long as the result records are separate artifacts.

---

## 2. landscape positioning

### 2.1 the field has arrived

Specification-driven development for AI is no longer speculative. As of early 2026:

- **Amazon Kiro** (July 2025): Full IDE with 3-phase spec workflow, EARS notation, agent hooks. Substantially lighter than BDSK.
- **GitHub spec-kit** (September 2025): CLI + templates for 4 gated phases. Intentionally minimal. No formal governance.
- **Tessl** (beta, 2025): "Spec-as-source" with a Spec Registry of 10,000+ library specs. Prevents API hallucination via grounding registry.
- **Martin Fowler's SDD taxonomy** (October 2025): Three levels -- spec-first (disposable), spec-anchored (living), spec-as-source (generative).

BDSK sits beyond all of these in rigor. Its closest parallel is not a dev tool -- it is a lightweight safety-critical lifecycle standard (IEC 62304, DO-178C) adapted for AI-assisted development.

### 2.2 what the market validated

The commercially successful approaches share three properties:

1. **AI generates the governance artifacts.** Humans review and approve; they don't hand-write YAML. Every successful tool (Kiro, spec-kit, Tessl) works this way.
2. **Governance is automated or invisible.** Validation runs in CI, not in a developer's mental model. Teams tolerate governance only when it doesn't add manual steps.
3. **Lightweight beats comprehensive.** spec-kit (4 phases, no schema validation) has broader adoption than any tool requiring formal artifacts.

### 2.3 where BDSK is uniquely strong

1. **Formal trace model** -- No other tool has normalized, validatable trace edges between artifacts.
2. **Execution-phase evals** -- Only the EDDOps paper (arxiv 2411.13768) also separates "did the code work?" from "did the AI process stay within bounds?"
3. **Authority matrix and waiver model** -- Pure regulated-industry features that no dev tool offers.
4. **Machine-readable conformance reports** -- The validator with 37 error codes and deterministic acceptance computation is unique.

### 2.4 the proportionality question

| Audience | Verdict |
|---|---|
| Solo developers | Too heavy. Kiro or spec-kit is right-sized. |
| Small teams (2-10) | Heavy but partially valuable. behavior_spec + assumption_record + execution_plan are the high-value artifacts. The full authority matrix is overkill. |
| Enterprise teams (10+) with multiple AI agents | Well-sized IF artifact creation is AI-assisted. The authority matrix, waiver model, and validator map to enterprise change management. |
| Regulated industries | May be too light. Lacks risk classification, hazard analysis, and regulatory submission artifacts that IEC 62304 / DO-178C require. |

### 2.5 the critical missing piece

BDSK specifies WHAT artifacts and rules are needed but not HOW they are generated. If humans must hand-write 12 YAML artifact types, adoption will be near zero. If an AI agent can generate a complete BDSK artifact set from a natural-language description and a codebase scan -- with humans only reviewing and approving -- BDSK becomes viable.

This is the bridge between the spec and practical use: BDSK needs a generation layer, not just a validation layer.

---

## 3. Claude Code integration design

### 3.1 integration surfaces

Claude Code provides five extension points relevant to BDSK:

| Surface | What it does | BDSK mapping |
|---|---|---|
| **CLAUDE.md** | Persistent context loaded every session | Codegen policies, architectural constraints, BDSK rules summary |
| **Hooks** | Shell commands that fire on lifecycle events; can block actions | Review gates (PreToolUse), audit logging (PostToolUse), scope enforcement |
| **MCP servers** | Custom tools available during sessions | Validator tool, artifact creator, trace checker |
| **Skills** | Reusable task playbooks invocable via /command | /create-behavior-spec, /validate-bdsk, /check-assumptions |
| **Settings** | Permission modes, allow/deny rules | Boundary discipline, forbidden operations |

### 3.2 the practical architecture

BDSK in Claude Code should work as three layers:

**Layer 1: Context (CLAUDE.md + rules)**

The project CLAUDE.md and `.claude/rules/` files encode the "always-on" governance context. This is where codegen policies, approved dependencies, and architectural constraints live in a form Claude reads every session.

```
.claude/
  CLAUDE.md                    # Project-level governance summary
  rules/
    bdsk-governance.md         # BDSK principles and current phase
    approved-dependencies.md   # From codegen_policy artifacts
    architecture-boundaries.md # Scope constraints
```

These are NOT the formal BDSK YAML artifacts -- they are human-readable distillations that Claude consumes as context. The formal artifacts live in `artifacts/` and are the source of truth.

**Layer 2: Skills (artifact generation + validation)**

Skills are the primary user interface. A developer never hand-writes YAML. Instead:

- `/specify <feature>` -- AI generates a behavior_spec with concrete examples from a natural-language description
- `/assume` -- AI captures an assumption as a structured assumption_record
- `/plan-execution` -- AI generates an execution_plan from approved behavior specs
- `/validate` -- Runs the BDSK validator against the artifacts/ directory
- `/accept` -- Computes Algorithm E and generates an acceptance_decision

Note: `/discover` and `/check-gates` were considered but deferred. Discovery is handled by the Explore agent naturally. Gate checking is folded into `/validate`.

Each skill generates the YAML artifact, writes it to the correct `artifacts/` subdirectory, and asks the human to review and approve. The human's approval (changing `status: draft` to `status: approved`) is the governance act.

**Layer 3: Hooks (enforcement)**

Hooks enforce BDSK rules during execution:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/check-scope.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/log-change.sh"
          }
        ]
      }
    ]
  }
}
```

- `check-scope.sh` reads the active execution_plan's `in_scope_paths` and `out_of_scope_paths`, checks if the file being edited is in scope, and returns exit code 2 (block) if not.
- `log-change.sh` appends to the execution_log artifact, recording which files were changed and when.

### 3.3 mapping BDSK lifecycle phases to Claude Code workflow

| BDSK phase | Claude Code mechanism | User experience |
|---|---|---|
| **1. Discovery** | Explore agent + /discover skill | "Explore this codebase and surface what we need to specify" |
| **2. Specification** | /specify skill generates behavior_specs | "Here's what the feature should do" -> AI generates spec -> human reviews |
| **3. Constraint definition** | /plan-execution skill + CLAUDE.md update | AI generates execution_plan + codegen_policy -> human approves -> CLAUDE.md auto-updated |
| **4. Execution** | Normal Claude Code session with hooks enforcing scope | Developer works with Claude normally; hooks block out-of-scope edits |
| **5. Execution evaluation** | /validate skill or PostToolUse hooks | Automatic check: did the AI stay within bounds? |
| **6. Verification** | /verify skill triggers test generation and runs | AI generates verification artifacts (tests), runs them, records results |
| **7. Acceptance** | /accept skill computes Algorithm E | Computes acceptance eligibility, presents findings, records decision |

### 3.4 what this looks like in practice

A developer's session might look like:

```
> /specify "User can reset their password via email"

[Claude generates behavior_spec with concrete examples, writes to artifacts/behaviors/]
[Claude generates assumption_records for email delivery, writes to artifacts/assumptions/]
[Human reviews, changes status to approved]

> /plan-execution

[Claude generates execution_plan from approved specs, writes to artifacts/execution-plans/]
[Claude updates .claude/rules/current-execution.md with scope boundaries]
[Human reviews, approves]

> Now implement the password reset feature

[Claude works normally -- reads files, writes code, runs tests]
[PreToolUse hook checks every edit against in_scope_paths]
[PostToolUse hook logs every change to execution_log]
[If Claude tries to edit auth middleware (out of scope), hook blocks it]

> /validate

[Validator runs: checks trace integrity, gate coverage, verification coverage]
[Reports: 2 behavior specs covered, 1 assumption unresolved, all gates pass]

> /accept

[Algorithm E runs: all conditions met -> accepted]
[acceptance_decision artifact written]
```

### 3.5 the MCP server role

For teams that want programmatic governance, an MCP server provides tools that Claude can call during execution:

- `validate_artifact(path)` -- Schema-validate a single artifact
- `check_trace_integrity()` -- Run RI-1 through RI-10
- `get_execution_scope()` -- Return current in_scope/out_of_scope paths
- `record_uncertainty(description)` -- Create a surfaced_uncertainty in the execution log
- `check_assumption(id)` -- Verify an assumption is still accepted before depending on it

This makes governance a tool Claude uses, not a ceremony the developer performs.

### 3.6 what must change in the spec for Claude Code integration

The spec is designed as a general governance framework. To work practically in Claude Code, it needs:

1. **A generation protocol alongside the validation protocol.** The spec defines how to VALIDATE artifacts but not how to GENERATE them from natural language. A companion spec or addendum should define how an AI agent (like Claude) produces conformant artifacts from user prompts.

2. **Relaxed bootstrap rules.** The first behavior spec in a new project must be creatable without upstream artifacts. The spec should explicitly allow empty upstream traces for initial discovery-phase artifacts.

3. **Approval recording in the envelope.** The `owners` field is insufficient. An `approvals` array (or at minimum, an `approved_by` field) is needed for authority validation to work.

4. **Implicit grounding for repository code.** When Claude reads existing code and reuses patterns from it, that should count as grounded without requiring a contract artifact for every function.

5. **Lightweight mode.** A "BDSK-lite" profile that uses only behavior_spec, assumption_record, execution_plan, and verification_artifact (4 of 12 types) would be practical for small teams. The full 12-type system is for enterprise use.

---

## 4. recommendations

### 4.1 spec changes before implementing the validator

| Priority | Change | Rationale |
|---|---|---|
| P0 | Add `approvals` field to canonical envelope | Authority validation is unimplementable without it |
| P0 | Define bootstrap rules (empty upstream allowed for initial artifacts) | Cannot start a BDSK repository otherwise |
| P0 | Resolve "rule id" in waiver model | Waivers can't reference rules that aren't artifacts |
| P1 | Add bidirectional trace consistency rule (TR-6) | Trace graph is unreliable without it |
| P1 | Fix contract_artifact downstream edges (`proves` -> `constrains`) | Semantic error |
| P1 | Complete the authority matrix for all artifact types | 5 types have no approval authority defined |
| P1 | Define status state machines per artifact kind | Undefined transitions cause interop problems |
| P2 | Operationally define "grounding" | Currently subjective |
| P2 | Define Algorithm E behavior for partial repositories | Returns `indeterminate` |
| P2 | Clarify dual-purpose evidence in verification vs. eval | Allow shared evidence_refs |

### 4.2 implementation sequence

1. **Fix the P0 spec issues** -- These block a correct validator.
2. **Build the schema pack** (done) and update for spec changes.
3. **Build Claude Code skills** for artifact generation -- This is the adoption enabler.
4. **Build the validator** as an MCP server -- Callable by Claude and by CI.
5. **Build hooks** for execution-phase enforcement -- The runtime governance layer.
6. **Write a "BDSK in 5 minutes" tutorial** showing the /specify -> /plan -> implement -> /validate -> /accept flow in Claude Code.

### 4.3 the bottom line

The BDSK specification is detailed and well-structured, but it has critical coherence gaps (bootstrap, authority recording, waiver targets) that must be fixed before the validator can be correctly implemented. The spec is also positioned at the heavy end of the governance spectrum -- its full value is realized only when AI generates the artifacts and validation runs automatically.

The integration path with Claude Code is clear and practical: CLAUDE.md for persistent policy, skills for artifact generation, hooks for runtime enforcement, and an MCP server for programmatic validation. The key design principle: **governance that the developer never has to think about is governance that gets adopted.**
