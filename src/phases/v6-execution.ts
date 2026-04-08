import { ArtifactIndex } from "../core/artifact-index.js";
import type { Finding } from "../types/findings.js";

export function validateExecutionConformance(index: ArtifactIndex): Finding[] {
  const findings: Finding[] = [];

  for (const ep of index.allOfKind("execution_plan")) {
    if (index.schemaInvalid.has(ep.id)) continue;
    algorithmA_executionStart(index, ep.id, findings);
    algorithmB_stopConditions(index, ep.id, findings);
    algorithmC_gateEvaluation(index, ep.id, findings);
  }

  return findings;
}

/** Algorithm A: Execution start validation. */
function algorithmA_executionStart(
  index: ArtifactIndex,
  epId: string,
  findings: Finding[],
): void {
  const ep = index.get(epId)!;
  const inputs = ep.spec.required_inputs as Record<string, unknown> | undefined;
  if (!inputs) return;

  // Check required policies exist
  const policies = inputs.policies as string[] | undefined;
  if (policies) {
    for (const policyId of policies) {
      if (!index.get(policyId)) {
        findings.push({
          code: "BDSK-EXEC-001",
          severity: "error",
          category: "execution",
          artifact_id: ep.id,
          message: `Execution plan missing required policy '${policyId}'`,
          details: { missing: policyId, type: "policy" },
        });
      }
    }
  }

  // Check required review gates exist
  const gates = inputs.review_gates as string[] | undefined;
  if (gates) {
    for (const gateId of gates) {
      if (!index.get(gateId)) {
        findings.push({
          code: "BDSK-EXEC-001",
          severity: "error",
          category: "execution",
          artifact_id: ep.id,
          message: `Execution plan missing required review gate '${gateId}'`,
          details: { missing: gateId, type: "review_gate" },
        });
      }
    }
  }

  // Check no high/critical assumptions are unresolved
  for (const ar of index.allOfKind("assumption_record")) {
    if (index.schemaInvalid.has(ar.id)) continue;
    const impact = (ar.metadata as Record<string, unknown>).impact_level as string | undefined;
    if ((impact === "high" || impact === "critical") &&
        (ar.status === "proposed" || ar.status === "needs-review")) {
      // Only flag if this assumption is referenced by this plan
      const isReferenced = ep.trace.upstream.some((r) => r.target_id === ar.id);
      if (isReferenced) {
        findings.push({
          code: "BDSK-EXEC-002",
          severity: "error",
          category: "execution",
          artifact_id: ep.id,
          message: `Unresolved ${impact} assumption '${ar.id}' at execution start`,
          details: { assumption_id: ar.id, impact_level: impact, status: ar.status },
        });
      }
    }
  }
}

/** Algorithm B: Stop-condition evaluation. */
function algorithmB_stopConditions(
  index: ArtifactIndex,
  epId: string,
  findings: Finding[],
): void {
  // Find execution logs for this plan
  const logs = index.allOfKind("execution_log").filter((log) =>
    log.trace.upstream.some((r) => r.target_id === epId && r.edge === "depends_on"),
  );

  for (const log of logs) {
    if (index.schemaInvalid.has(log.id)) continue;
    const triggered = log.spec.stop_conditions_triggered as string[] | undefined;
    if (!triggered || triggered.length === 0) continue;

    // Per the schema, stop_conditions_triggered is string[].
    // Any triggered stop condition in a completed log is a breach
    // unless final_state is "aborted" or "escalated".
    const finalState = log.spec.final_state as string | undefined;
    if (finalState === "aborted" || finalState === "escalated") continue;

    for (const condition of triggered) {
      findings.push({
        code: "BDSK-EXEC-003",
        severity: "error",
        category: "execution",
        artifact_id: log.id,
        message: `Stop condition '${condition}' triggered without valid escalation/abort/waiver`,
        details: { condition, execution_plan: epId },
      });
    }
  }

  // Warn if no log exists at all
  if (logs.length === 0) {
    findings.push({
      code: "BDSK-EXEC-004",
      severity: "warning",
      category: "execution",
      artifact_id: epId,
      message: "Execution log missing or incomplete",
      details: {},
    });
  }
}

/** Algorithm C: Gate evaluation. */
function algorithmC_gateEvaluation(
  index: ArtifactIndex,
  epId: string,
  findings: Finding[],
): void {
  const ep = index.get(epId)!;
  const inputs = ep.spec.required_inputs as Record<string, unknown> | undefined;
  const gateIds = inputs?.review_gates as string[] | undefined;
  if (!gateIds) return;

  for (const gateId of gateIds) {
    const gate = index.get(gateId);
    if (!gate) continue; // Algorithm A already catches missing gates

    const gateClass = (gate.metadata as Record<string, unknown>).gate_class as string | undefined;

    // Find execution_eval for this gate
    const evals = index.allOfKind("execution_eval").filter((ee) => {
      const subjectGate = (ee.spec as Record<string, unknown>).subject_gate as string | undefined;
      return subjectGate === gateId;
    });

    // Find approved waivers
    const waivers = index.allOfKind("waiver_record").filter((w) =>
      w.status === "approved" &&
      (w.spec as Record<string, unknown>).waived_target === gateId,
    );

    if (evals.length === 0 && waivers.length === 0) {
      findings.push({
        code: "BDSK-GATE-004",
        severity: "warning",
        category: "gate",
        artifact_id: epId,
        message: `No evaluation found for gate '${gateId}'`,
        details: { gate_id: gateId },
      });
      continue;
    }

    // Check eval results
    for (const ee of evals) {
      const result = (ee.spec as Record<string, unknown>).result as string | undefined;

      if (result === "fail" && gateClass === "blocking") {
        if (waivers.length === 0) {
          findings.push({
            code: "BDSK-GATE-001",
            severity: "error",
            category: "gate",
            artifact_id: epId,
            message: `Blocking gate '${gateId}' failed without approved waiver`,
            details: { gate_id: gateId, eval_id: ee.id },
          });
        }
      }
    }

    if (gateClass === "manual-review") {
      const passed = evals.some((ee) => (ee.spec as Record<string, unknown>).result === "pass");
      if (!passed) {
        findings.push({
          code: "BDSK-GATE-002",
          severity: "error",
          category: "gate",
          artifact_id: epId,
          message: `Manual-review gate '${gateId}' unresolved`,
          details: { gate_id: gateId },
        });
      }
    }

    if (gateClass === "escalation") {
      const passed = evals.some((ee) => (ee.spec as Record<string, unknown>).result === "pass");
      if (!passed) {
        findings.push({
          code: "BDSK-GATE-003",
          severity: "error",
          category: "gate",
          artifact_id: epId,
          message: `Escalation gate '${gateId}' unresolved`,
          details: { gate_id: gateId },
        });
      }
    }
  }
}
