/**
 * Default authority matrix from BDSK v0.3 spec and validator-spec section 5.5.
 * Maps action keys to sets of required authority roles.
 */

export type AuthorityAction =
  | "behavior_spec_approval"
  | "assumption_acceptance_product"
  | "assumption_acceptance_architecture"
  | "assumption_acceptance_security"
  | "codegen_policy_approval"
  | "review_gate_approval"
  | "review_gate_approval_security"
  | "execution_plan_approval"
  | "waiver_warning_gate"
  | "waiver_blocking_security_gate"
  | "acceptance_decision"
  | "acceptance_decision_production";

const DEFAULT_MATRIX: Record<AuthorityAction, string[]> = {
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

export interface AuthorityConfig {
  matrix: Record<string, string[]>;
  custom_roles: string[];
}

export function getDefaultMatrix(): Record<AuthorityAction, string[]> {
  return { ...DEFAULT_MATRIX };
}

/**
 * Merge a custom authority config with the defaults.
 * Custom configs can only be STRICTER (require more roles), never weaker.
 * Returns null if the custom config attempts to weaken any action.
 */
export function mergeAuthorityConfig(
  custom: Partial<Record<string, string[]>>,
): { config: AuthorityConfig; violations: string[] } {
  const violations: string[] = [];
  const merged = { ...DEFAULT_MATRIX } as Record<string, string[]>;

  for (const [action, customRoles] of Object.entries(custom)) {
    if (action === "custom_roles" || !customRoles) continue;
    const defaultRoles = DEFAULT_MATRIX[action as AuthorityAction];
    if (!defaultRoles) {
      merged[action] = customRoles;
      continue;
    }
    for (const req of defaultRoles) {
      if (!customRoles.includes(req)) {
        violations.push(
          `Custom config weakens '${action}': missing required role '${req}'`,
        );
      }
    }
    if (violations.length === 0) {
      merged[action] = customRoles;
    }
  }

  return {
    config: { matrix: merged, custom_roles: (custom as Record<string, unknown>).custom_roles as string[] ?? [] },
    violations,
  };
}

/** Check if a set of roles satisfies the requirement for an action (any one role suffices). */
export function satisfiesAuthority(
  action: AuthorityAction,
  roles: string[],
  config?: AuthorityConfig,
): boolean {
  const required = config?.matrix[action] ?? DEFAULT_MATRIX[action];
  if (!required) return true;
  return roles.some((r) => required.includes(r));
}

/** Get the known authority roles (default + custom). */
export function getAllKnownRoles(config?: AuthorityConfig): Set<string> {
  const roles = new Set<string>();
  for (const roleList of Object.values(DEFAULT_MATRIX)) {
    for (const r of roleList) roles.add(r);
  }
  if (config?.custom_roles) {
    for (const r of config.custom_roles) roles.add(r);
  }
  return roles;
}
