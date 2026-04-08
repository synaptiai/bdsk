/**
 * Default authority matrix from BDSK v0.3 spec and validator-spec section 5.5.
 * Maps action keys to sets of required authority roles.
 */
const DEFAULT_MATRIX = {
    behavior_spec_approval: ["product_authority", "technical_authority"],
    assumption_acceptance_product: ["product_authority"],
    assumption_acceptance_architecture: ["technical_authority"],
    assumption_acceptance_security: ["security_authority"],
    codegen_policy_approval: ["technical_authority"],
    review_gate_approval: ["technical_authority"],
    review_gate_approval_security: ["technical_authority", "security_authority"],
    execution_plan_approval: ["technical_authority"],
    waiver_warning_gate: ["technical_authority", "qa_authority"],
    waiver_blocking_security_gate: ["security_authority"],
    acceptance_decision: ["release_authority"],
    acceptance_decision_production: ["release_authority", "qa_authority"],
};
export function getDefaultMatrix() {
    return { ...DEFAULT_MATRIX };
}
/**
 * Merge a custom authority config with the defaults.
 * Custom configs can only be STRICTER (require more roles), never weaker.
 * Returns null if the custom config attempts to weaken any action.
 */
export function mergeAuthorityConfig(custom) {
    const violations = [];
    // Pass 1: validate all entries for weakness
    for (const [action, customRoles] of Object.entries(custom)) {
        if (action === "custom_roles" || !customRoles)
            continue;
        const defaultRoles = DEFAULT_MATRIX[action];
        if (!defaultRoles)
            continue;
        for (const req of defaultRoles) {
            if (!customRoles.includes(req)) {
                violations.push(`Custom config weakens '${action}': missing required role '${req}'`);
            }
        }
    }
    // Pass 2: only merge if no violations found
    const merged = { ...DEFAULT_MATRIX };
    if (violations.length === 0) {
        for (const [action, customRoles] of Object.entries(custom)) {
            if (action === "custom_roles" || !customRoles)
                continue;
            merged[action] = customRoles;
        }
    }
    return {
        config: { matrix: merged, custom_roles: custom.custom_roles ?? [] },
        violations,
    };
}
/** Check if a set of roles satisfies the requirement for an action (any one role suffices). */
export function satisfiesAuthority(action, roles, config) {
    const required = config?.matrix[action] ?? DEFAULT_MATRIX[action];
    if (!required)
        return true;
    return roles.some((r) => required.includes(r));
}
/** Get the known authority roles (default + custom). */
export function getAllKnownRoles(config) {
    const roles = new Set();
    for (const roleList of Object.values(DEFAULT_MATRIX)) {
        for (const r of roleList)
            roles.add(r);
    }
    if (config?.custom_roles) {
        for (const r of config.custom_roles)
            roles.add(r);
    }
    return roles;
}
//# sourceMappingURL=authority-matrix.js.map