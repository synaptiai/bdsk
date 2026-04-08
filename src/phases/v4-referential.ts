import { ArtifactIndex } from "../core/artifact-index.js";
import { asExecutionPlanSpec, asExecutionEvalSpec, asAcceptanceDecisionSpec } from "../types/artifact.js";
import type { Finding } from "../types/findings.js";

export function validateReferentialIntegrity(index: ArtifactIndex, now?: Date): Finding[] {
  const findings: Finding[] = [];

  ri1_targetExistence(index, findings);
  ri3_governingInputApproval(index, findings);
  ri4_diffMappingCompleteness(index, findings);
  ri5_verificationCoverage(index, findings);
  ri6_gateEvaluationCoverage(index, findings);
  ri7_waiverTargetValidity(index, findings, now ?? new Date());
  ri8_acceptanceEvidenceCompleteness(index, findings);
  ri9_supersessionConsistency(index, findings);
  ri10_executionCompletionIntegrity(index, findings);

  return findings;
}

/** RI-1: Every target_id must resolve to an existing artifact. */
function ri1_targetExistence(index: ArtifactIndex, findings: Finding[]): void {
  for (const artifact of index.byId.values()) {
    if (index.schemaInvalid.has(artifact.id)) continue;
    const allRefs = [...artifact.trace.upstream, ...artifact.trace.downstream];
    for (const ref of allRefs) {
      if (!index.get(ref.target_id)) {
        findings.push({
          code: "BDSK-REF-001",
          severity: "error",
          category: "reference",
          artifact_id: artifact.id,
          message: `References missing artifact '${ref.target_id}'`,
          details: { target_id: ref.target_id, edge: ref.edge },
        });
      }
    }
  }
}

/** RI-3: Governing inputs for execution plans must be approved/accepted. */
function ri3_governingInputApproval(index: ArtifactIndex, findings: Finding[]): void {
  for (const ep of index.allOfKind("execution_plan")) {
    if (index.schemaInvalid.has(ep.id)) continue;
    for (const ref of ep.trace.upstream.filter((r) => r.edge === "depends_on")) {
      const target = index.get(ref.target_id);
      if (!target) continue; // RI-1 already catches this
      const validStatuses = target.kind === "assumption_record"
        ? ["accepted"]
        : ["approved"];
      if (!validStatuses.includes(target.status)) {
        findings.push({
          code: "BDSK-REF-002",
          severity: "error",
          category: "reference",
          artifact_id: ep.id,
          message: `Governing input '${target.id}' is '${target.status}', expected ${validStatuses.join(" or ")}`,
          details: { target_id: target.id, target_status: target.status, expected: validStatuses },
        });
      }
    }
  }
}

/** RI-4: Generated diffs must have produced_by and implements traces. */
function ri4_diffMappingCompleteness(index: ArtifactIndex, findings: Finding[]): void {
  for (const diff of index.allOfKind("generated_diff")) {
    if (index.schemaInvalid.has(diff.id)) continue;
    const hasProducedBy = diff.trace.upstream.some((r) => r.edge === "produced_by");
    const hasImplements = diff.trace.upstream.some((r) => r.edge === "implements");
    if (!hasProducedBy || !hasImplements) {
      findings.push({
        code: "BDSK-REF-005",
        severity: "error",
        category: "reference",
        artifact_id: diff.id,
        message: `Generated diff missing required traces: ${!hasProducedBy ? "produced_by" : ""} ${!hasImplements ? "implements" : ""}`.trim(),
        details: { has_produced_by: hasProducedBy, has_implements: hasImplements },
      });
    }
  }
}

/** RI-5: Each behavior spec in an execution plan must have verification coverage. */
function ri5_verificationCoverage(index: ArtifactIndex, findings: Finding[]): void {
  for (const ep of index.allOfKind("execution_plan")) {
    if (index.schemaInvalid.has(ep.id)) continue;
    const behaviors = asExecutionPlanSpec(ep).required_inputs?.behaviors;
    if (!behaviors) continue;
    for (const bsId of behaviors) {
      // Find verification artifacts that prove this behavior spec
      const provers = index.incomingRefs(bsId, "proves")
        .filter((a) => a.kind === "verification_artifact");
      if (provers.length === 0) {
        findings.push({
          code: "BDSK-REF-003",
          severity: "error",
          category: "reference",
          artifact_id: ep.id,
          message: `Behavior spec '${bsId}' lacks verification coverage`,
          details: { behavior_spec_id: bsId },
        });
      }
    }
  }
}

/** RI-6: Each review gate in an execution plan must have eval coverage or waiver. */
function ri6_gateEvaluationCoverage(index: ArtifactIndex, findings: Finding[]): void {
  for (const ep of index.allOfKind("execution_plan")) {
    if (index.schemaInvalid.has(ep.id)) continue;
    const gates = asExecutionPlanSpec(ep).required_inputs?.review_gates;
    if (!gates) continue;
    for (const gateId of gates) {
      // Find evals by subject_gate field or by trace edge
      const evalsByTrace = index.incomingRefs(gateId, "evaluates")
        .filter((a) => a.kind === "execution_eval");
      const evalsByField = index.allOfKind("execution_eval")
        .filter((ee) => asExecutionEvalSpec(ee).subject_gate === gateId);
      const evals = [...new Map([...evalsByTrace, ...evalsByField].map((e) => [e.id, e])).values()];
      const waiversByTrace = index.incomingRefs(gateId, "waives")
        .filter((a) => a.kind === "waiver_record" && a.status === "approved");
      const waiversByField = index.allOfKind("waiver_record")
        .filter((w) => w.status === "approved" && w.spec.waived_target === gateId);
      const waivers = [...new Map([...waiversByTrace, ...waiversByField].map((w) => [w.id, w])).values()];
      if (evals.length === 0 && waivers.length === 0) {
        findings.push({
          code: "BDSK-REF-004",
          severity: "error",
          category: "reference",
          artifact_id: ep.id,
          message: `Review gate '${gateId}' has no execution eval and no approved waiver`,
          details: { gate_id: gateId },
        });
      }
    }
  }
}

/** RI-7: Waiver targets must exist and be waivable. */
function ri7_waiverTargetValidity(index: ArtifactIndex, findings: Finding[], now: Date): void {
  for (const waiver of index.allOfKind("waiver_record")) {
    if (index.schemaInvalid.has(waiver.id)) continue;
    const targetId = waiver.spec.waived_target as string | undefined;
    if (!targetId) continue;
    const target = index.get(targetId);
    if (!target) {
      findings.push({
        code: "BDSK-WAIVER-001",
        severity: "error",
        category: "waiver",
        artifact_id: waiver.id,
        message: `Waiver targets non-existent artifact '${targetId}'`,
        details: { waived_target: targetId },
      });
    } else if (target.kind !== "review_gate") {
      findings.push({
        code: "BDSK-WAIVER-001",
        severity: "error",
        category: "waiver",
        artifact_id: waiver.id,
        message: `Waiver targets '${targetId}' which is a '${target.kind}', not a review_gate`,
        details: { waived_target: targetId, target_kind: target.kind },
      });
    }

    // Check for expired waivers
    const validUntil = waiver.spec.valid_until as string | undefined;
    if (validUntil) {
      const expiry = new Date(validUntil);
      if (expiry < now) {
        findings.push({
          code: "BDSK-WAIVER-002",
          severity: "warning",
          category: "waiver",
          artifact_id: waiver.id,
          message: `Waiver expired at ${validUntil}`,
          details: { valid_until: validUntil },
        });
      }
    }
  }
}

/** RI-8: Acceptance decisions with accepted/conditionally_accepted must have complete evidence. */
function ri8_acceptanceEvidenceCompleteness(index: ArtifactIndex, findings: Finding[]): void {
  for (const ad of index.allOfKind("acceptance_decision")) {
    if (index.schemaInvalid.has(ad.id)) continue;
    const outcome = ad.metadata.outcome as string | undefined;
    if (outcome !== "accepted" && outcome !== "conditionally_accepted") continue;

    const subjectDiffs = asAcceptanceDecisionSpec(ad).subject_diffs;
    if (!subjectDiffs || subjectDiffs.length === 0) {
      findings.push({
        code: "BDSK-ACC-001",
        severity: "error",
        category: "acceptance",
        artifact_id: ad.id,
        message: "Acceptance recorded without subject_diffs",
        details: {},
      });
      continue;
    }

    // Check all referenced diffs exist
    for (const diffId of subjectDiffs) {
      if (!index.get(diffId)) {
        findings.push({
          code: "BDSK-ACC-001",
          severity: "error",
          category: "acceptance",
          artifact_id: ad.id,
          message: `Acceptance references non-existent diff '${diffId}'`,
          details: { diff_id: diffId },
        });
      }
    }

    // Check upstream depends_on includes verification and eval evidence
    const upDeps = ad.trace.upstream.filter((r) => r.edge === "depends_on");
    const hasVerification = upDeps.some((r) => {
      const t = index.get(r.target_id);
      return t?.kind === "verification_artifact";
    });
    const hasEval = upDeps.some((r) => {
      const t = index.get(r.target_id);
      return t?.kind === "execution_eval";
    });
    if (!hasVerification || !hasEval) {
      findings.push({
        code: "BDSK-ACC-001",
        severity: "error",
        category: "acceptance",
        artifact_id: ad.id,
        message: `Acceptance evidence incomplete: ${!hasVerification ? "missing verification_artifact" : ""} ${!hasEval ? "missing execution_eval" : ""}`.trim(),
        details: { has_verification: hasVerification, has_eval: hasEval },
      });
    }
  }
}

/** RI-9: Superseded artifacts must have correct status. */
function ri9_supersessionConsistency(index: ArtifactIndex, findings: Finding[]): void {
  for (const artifact of index.byId.values()) {
    if (index.schemaInvalid.has(artifact.id)) continue;
    const supersedes = [...artifact.trace.upstream, ...artifact.trace.downstream]
      .filter((r) => r.edge === "supersedes");
    for (const ref of supersedes) {
      const target = index.get(ref.target_id);
      if (!target) continue; // RI-1 catches this
      if (target.status !== "superseded" && target.status !== "archived") {
        findings.push({
          code: "BDSK-REF-006",
          severity: "warning",
          category: "reference",
          artifact_id: artifact.id,
          message: `Superseded artifact '${target.id}' has status '${target.status}', expected 'superseded' or 'archived'`,
          details: { target_id: target.id, target_status: target.status },
        });
      }
    }
  }
}

/** RI-10: Execution logs with completed final_state must handle stop conditions.
 *  Note: V6 Algorithm B performs the detailed check with aborted/escalated handling.
 *  RI-10 only flags that a completed log has triggered conditions (structural integrity). */
function ri10_executionCompletionIntegrity(index: ArtifactIndex, findings: Finding[]): void {
  // Intentionally empty: stop-condition checking is owned by V6 Algorithm B
  // which has proper handling for final_state aborted/escalated.
  // Keeping this function as a placeholder for RI-10 structural documentation.
}
