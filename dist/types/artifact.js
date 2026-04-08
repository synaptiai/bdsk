export const ARTIFACT_KINDS = [
    "behavior_spec",
    "assumption_record",
    "contract_artifact",
    "codegen_policy",
    "review_gate",
    "execution_plan",
    "generated_diff",
    "verification_artifact",
    "execution_eval",
    "execution_log",
    "waiver_record",
    "acceptance_decision",
];
export const TRACE_EDGES = [
    "depends_on",
    "derived_from",
    "constrains",
    "implements",
    "proves",
    "evaluates",
    "produced_by",
    "supersedes",
    "escalates_to",
    "waives",
];
/** Type-safe accessor for execution plan spec fields. */
export function asExecutionPlanSpec(artifact) {
    return artifact.spec;
}
/** Type-safe accessor for review gate metadata. */
export function asReviewGateMetadata(artifact) {
    return artifact.metadata;
}
/** Type-safe accessor for execution eval spec. */
export function asExecutionEvalSpec(artifact) {
    return artifact.spec;
}
/** Type-safe accessor for execution log spec. */
export function asExecutionLogSpec(artifact) {
    return artifact.spec;
}
/** Type-safe accessor for acceptance decision spec. */
export function asAcceptanceDecisionSpec(artifact) {
    return artifact.spec;
}
//# sourceMappingURL=artifact.js.map