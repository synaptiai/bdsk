import { asReviewGateMetadata, asAcceptanceDecisionSpec } from "../types/artifact.js";
import { satisfiesAuthority, getAllKnownRoles, } from "../core/authority-matrix.js";
export function validateAuthority(index, config) {
    const findings = [];
    au1_approvalAuthority(index, config, findings);
    au3_waiverAuthority(index, config, findings);
    au4_escalationAuthority(index, config, findings);
    au5_acceptanceAuthority(index, config, findings);
    return findings;
}
/** AU-1: Approved artifacts must have the required authority role. */
function au1_approvalAuthority(index, config, findings) {
    const kindToAction = {
        behavior_spec: "behavior_spec_approval",
        codegen_policy: "codegen_policy_approval",
        review_gate: "review_gate_approval",
        execution_plan: "execution_plan_approval",
    };
    for (const artifact of index.byId.values()) {
        if (index.schemaInvalid.has(artifact.id))
            continue;
        if (artifact.status !== "approved")
            continue;
        const action = kindToAction[artifact.kind];
        if (!action)
            continue;
        // For assumption_records, determine area-specific action
        let effectiveAction = action;
        if (artifact.kind === "review_gate") {
            const gateMeta = asReviewGateMetadata(artifact);
            if (gateMeta.subject === "security") {
                effectiveAction = "review_gate_approval_security";
            }
        }
        const approvalRoles = artifact.approvals.map((a) => a.authority_role);
        if (approvalRoles.length === 0 || !satisfiesAuthority(effectiveAction, approvalRoles, config)) {
            findings.push({
                code: "BDSK-AUTH-001",
                severity: "error",
                category: "authority",
                artifact_id: artifact.id,
                message: `Approval missing required authority role for ${effectiveAction}`,
                details: { action: effectiveAction, roles_present: approvalRoles },
            });
        }
    }
    // Also check assumption_records
    for (const ar of index.allOfKind("assumption_record")) {
        if (index.schemaInvalid.has(ar.id))
            continue;
        if (ar.status !== "accepted")
            continue;
        const area = ar.metadata.area;
        let action;
        switch (area) {
            case "security":
                action = "assumption_acceptance_security";
                break;
            case "architecture":
                action = "assumption_acceptance_architecture";
                break;
            default:
                action = "assumption_acceptance_product";
        }
        const approvalRoles = ar.approvals.map((a) => a.authority_role);
        if (approvalRoles.length === 0 || !satisfiesAuthority(action, approvalRoles, config)) {
            findings.push({
                code: "BDSK-AUTH-001",
                severity: "error",
                category: "authority",
                artifact_id: ar.id,
                message: `Acceptance missing required authority role for ${action}`,
                details: { action, area, roles_present: approvalRoles },
            });
        }
    }
}
/** AU-3: Waiver authority must match the class of the waived target. */
function au3_waiverAuthority(index, config, findings) {
    for (const waiver of index.allOfKind("waiver_record")) {
        if (index.schemaInvalid.has(waiver.id))
            continue;
        if (waiver.status !== "approved")
            continue;
        // Schema: spec.authority is a string (the role name)
        const authorityStr = waiver.spec.authority;
        if (!authorityStr)
            continue;
        const role = authorityStr;
        const targetId = waiver.spec.waived_target;
        if (!targetId)
            continue;
        const target = index.get(targetId);
        if (!target || target.kind !== "review_gate")
            continue;
        const gateMeta = asReviewGateMetadata(target);
        const isSecurity = gateMeta.subject === "security";
        const isBlocking = gateMeta.gate_class === "blocking";
        let action;
        if (isBlocking && isSecurity) {
            action = "waiver_blocking_security_gate";
        }
        else {
            action = "waiver_warning_gate";
        }
        if (!satisfiesAuthority(action, [role], config)) {
            findings.push({
                code: "BDSK-AUTH-002",
                severity: "error",
                category: "authority",
                artifact_id: waiver.id,
                message: `Waiver authority '${role}' not permitted for ${action}`,
                details: { role, action, target_id: targetId },
            });
        }
    }
}
/** AU-4: Escalation targets must resolve to known authority roles. */
function au4_escalationAuthority(index, config, findings) {
    const knownRoles = getAllKnownRoles(config);
    for (const artifact of index.byId.values()) {
        if (index.schemaInvalid.has(artifact.id))
            continue;
        const escalations = [...artifact.trace.upstream, ...artifact.trace.downstream]
            .filter((r) => r.edge === "escalates_to");
        for (const ref of escalations) {
            // The target_id for escalation should resolve to a known authority
            if (!knownRoles.has(ref.target_id) && !index.get(ref.target_id)) {
                findings.push({
                    code: "BDSK-AUTH-004",
                    severity: "error",
                    category: "authority",
                    artifact_id: artifact.id,
                    message: `Escalation target '${ref.target_id}' is not a recognized authority`,
                    details: { target_id: ref.target_id },
                });
            }
        }
    }
}
/** AU-5: Acceptance decision approvers must satisfy the authority matrix. */
function au5_acceptanceAuthority(index, config, findings) {
    for (const ad of index.allOfKind("acceptance_decision")) {
        if (index.schemaInvalid.has(ad.id))
            continue;
        const adSpec = asAcceptanceDecisionSpec(ad);
        const approvers = adSpec.approvers;
        if (!approvers || approvers.length === 0) {
            findings.push({
                code: "BDSK-AUTH-003",
                severity: "error",
                category: "authority",
                artifact_id: ad.id,
                message: "Acceptance decision has no approvers",
                details: {},
            });
            continue;
        }
        // Approvers in spec are string IDs; authority roles come from the envelope's approvals field
        const roles = ad.approvals.map((a) => a.authority_role).filter(Boolean);
        const action = "acceptance_decision";
        if (!satisfiesAuthority(action, roles, config)) {
            findings.push({
                code: "BDSK-AUTH-003",
                severity: "error",
                category: "authority",
                artifact_id: ad.id,
                message: `Acceptance approver set does not satisfy authority matrix for ${action}`,
                details: { roles_present: roles, action },
            });
        }
    }
}
//# sourceMappingURL=v5-authority.js.map