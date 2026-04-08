/**
 * Default authority matrix from BDSK v0.3 spec and validator-spec section 5.5.
 * Maps action keys to sets of required authority roles.
 */
export type AuthorityAction = "behavior_spec_approval" | "assumption_acceptance_product" | "assumption_acceptance_architecture" | "assumption_acceptance_security" | "codegen_policy_approval" | "review_gate_approval" | "review_gate_approval_security" | "execution_plan_approval" | "waiver_warning_gate" | "waiver_blocking_security_gate" | "acceptance_decision" | "acceptance_decision_production";
export interface AuthorityConfig {
    matrix: Record<string, string[]>;
    custom_roles: string[];
}
export declare function getDefaultMatrix(): Record<AuthorityAction, string[]>;
/**
 * Merge a custom authority config with the defaults.
 * Custom configs can only be STRICTER (require more roles), never weaker.
 * Returns null if the custom config attempts to weaken any action.
 */
export declare function mergeAuthorityConfig(custom: Partial<Record<string, string[]>>): {
    config: AuthorityConfig;
    violations: string[];
};
/** Check if a set of roles satisfies the requirement for an action (any one role suffices). */
export declare function satisfiesAuthority(action: AuthorityAction, roles: string[], config?: AuthorityConfig): boolean;
/** Get the known authority roles (default + custom). */
export declare function getAllKnownRoles(config?: AuthorityConfig): Set<string>;
//# sourceMappingURL=authority-matrix.d.ts.map