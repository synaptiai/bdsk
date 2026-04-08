# BDSK Governance Rules

These rules apply to all work in this repository.

## Principle: Behavior Before Implementation

Never generate implementation code without an approved behavior_spec that describes the intended behavior. Use `/specify` to create behavior specs before coding.

## Principle: Explicit Assumptions

Any decision, belief, or inference that affects implementation must be captured as an assumption_record via `/assume`. Assumptions must not remain implicit in prompts or code comments.

## Principle: Boundary Discipline

During execution, stay within the boundaries defined by the active execution_plan. The check-scope.sh hook enforces in_scope_paths and out_of_scope_paths. If you need to modify files outside scope, stop and update the execution plan.

## Principle: Grounding

Do not introduce external interfaces, library usage, or behavior claims unless grounded in:
- Approved BDSK artifacts
- Existing code in this repository
- Well-known standards (HTTP, JSON, SQL, etc.)

If something is not grounded, mark it for review or capture it as an assumption.

## Principle: Human Approval at Ambiguity

When uncertainty affects correctness, security, or architecture, stop and surface the issue. Use `/assume` to capture the uncertainty, then escalate for human decision.
