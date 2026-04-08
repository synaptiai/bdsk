// Encodes the full edge-kind compatibility matrix from validator-spec section 4.
// Key: "sourceKind:edge:direction" → Set of valid target kinds.
const MATRIX = new Map();
function allow(source, edge, dir, targets) {
    MATRIX.set(`${source}:${edge}:${dir}`, new Set(targets));
}
// --- Upstream edges (section 4, table 1) ---
allow("behavior_spec", "derived_from", "upstream", ["behavior_spec", "assumption_record"]);
allow("behavior_spec", "depends_on", "upstream", ["assumption_record", "contract_artifact"]);
allow("assumption_record", "derived_from", "upstream", ["behavior_spec", "assumption_record", "contract_artifact"]);
allow("codegen_policy", "derived_from", "upstream", ["codegen_policy"]);
allow("review_gate", "depends_on", "upstream", ["codegen_policy", "behavior_spec"]);
allow("execution_plan", "depends_on", "upstream", ["behavior_spec", "assumption_record", "contract_artifact", "codegen_policy", "review_gate"]);
allow("generated_diff", "produced_by", "upstream", ["execution_plan"]);
allow("generated_diff", "implements", "upstream", ["behavior_spec"]);
allow("generated_diff", "depends_on", "upstream", ["assumption_record", "contract_artifact"]);
allow("verification_artifact", "proves", "upstream", ["behavior_spec", "contract_artifact"]);
allow("verification_artifact", "depends_on", "upstream", ["generated_diff"]);
allow("execution_eval", "depends_on", "upstream", ["execution_plan", "review_gate", "execution_log"]);
allow("execution_eval", "evaluates", "upstream", ["generated_diff"]);
allow("execution_log", "depends_on", "upstream", ["execution_plan"]);
allow("waiver_record", "waives", "upstream", ["review_gate"]);
allow("waiver_record", "depends_on", "upstream", ["execution_plan", "generated_diff"]);
allow("acceptance_decision", "depends_on", "upstream", ["generated_diff", "verification_artifact", "execution_eval", "waiver_record"]);
// --- Downstream edges (section 4, table 2) ---
allow("behavior_spec", "proves", "downstream", ["verification_artifact"]);
allow("behavior_spec", "constrains", "downstream", ["execution_plan"]);
allow("assumption_record", "constrains", "downstream", ["behavior_spec", "generated_diff"]);
allow("contract_artifact", "constrains", "downstream", ["behavior_spec"]);
allow("contract_artifact", "proves", "downstream", ["verification_artifact"]);
allow("codegen_policy", "constrains", "downstream", ["execution_plan", "review_gate"]);
allow("review_gate", "evaluates", "downstream", ["execution_eval"]);
allow("execution_plan", "produced_by", "downstream", ["generated_diff"]);
allow("execution_plan", "evaluates", "downstream", ["execution_eval", "execution_log"]);
allow("generated_diff", "proves", "downstream", ["verification_artifact"]);
allow("generated_diff", "evaluates", "downstream", ["execution_eval"]);
allow("execution_log", "produced_by", "downstream", ["generated_diff"]);
allow("execution_log", "evaluates", "downstream", ["execution_eval"]);
allow("waiver_record", "depends_on", "downstream", ["acceptance_decision"]);
/**
 * Check whether (sourceKind, edge, targetKind) is valid for the given direction.
 * Returns true if the triple is allowed, false otherwise.
 */
export function isCompatible(sourceKind, edge, direction, targetKind) {
    const key = `${sourceKind}:${edge}:${direction}`;
    const validTargets = MATRIX.get(key);
    if (!validTargets)
        return false;
    return validTargets.has(targetKind);
}
//# sourceMappingURL=compatibility-matrix.js.map