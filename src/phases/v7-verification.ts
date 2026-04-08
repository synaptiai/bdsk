import { ArtifactIndex } from "../core/artifact-index.js";
import type { Finding } from "../types/findings.js";

export function validateVerificationCoverage(index: ArtifactIndex): Finding[] {
  const findings: Finding[] = [];

  for (const ep of index.allOfKind("execution_plan")) {
    if (index.schemaInvalid.has(ep.id)) continue;

    behaviorCoverage(index, ep.id, findings);
    contractCoverage(index, ep.id, findings);
  }

  separationCheck(index, findings);

  return findings;
}

/** Algorithm D step 1: Every required behavior spec must have a passing verification artifact. */
function behaviorCoverage(
  index: ArtifactIndex,
  epId: string,
  findings: Finding[],
): void {
  const ep = index.get(epId)!;
  const inputs = ep.spec.required_inputs as Record<string, unknown> | undefined;
  const behaviors = inputs?.behaviors as string[] | undefined;
  if (!behaviors) return;

  for (const bsId of behaviors) {
    const provers = index.incomingRefs(bsId, "proves")
      .filter((a) => a.kind === "verification_artifact");

    if (provers.length === 0) {
      findings.push({
        code: "BDSK-VER-001",
        severity: "error",
        category: "verification",
        artifact_id: epId,
        message: `Missing behavior verification: no artifact proves '${bsId}'`,
        details: { behavior_spec_id: bsId },
      });
    } else {
      // Check if any have a fail result
      for (const v of provers) {
        const result = (v.spec as Record<string, unknown>).execution_result as string | undefined;
        if (result === "fail") {
          findings.push({
            code: "BDSK-VER-003",
            severity: "error",
            category: "verification",
            artifact_id: epId,
            message: `Verification artifact '${v.id}' for '${bsId}' has result 'fail'`,
            details: { verification_id: v.id, behavior_spec_id: bsId },
          });
        }
      }
    }
  }
}

/** Algorithm D step 2: Every referenced contract must have verification coverage. */
function contractCoverage(
  index: ArtifactIndex,
  epId: string,
  findings: Finding[],
): void {
  const ep = index.get(epId)!;
  // Contracts referenced via depends_on in upstream
  const contractRefs = ep.trace.upstream
    .filter((r) => r.edge === "depends_on")
    .map((r) => index.get(r.target_id))
    .filter((a) => a?.kind === "contract_artifact");

  for (const contract of contractRefs) {
    if (!contract) continue;
    const provers = index.incomingRefs(contract.id, "proves")
      .filter((a) => a.kind === "verification_artifact");

    if (provers.length === 0) {
      findings.push({
        code: "BDSK-VER-002",
        severity: "error",
        category: "verification",
        artifact_id: epId,
        message: `Missing contract verification: no artifact proves '${contract.id}'`,
        details: { contract_id: contract.id },
      });
    }
  }
}

/** Algorithm D step 3: No artifact ID should appear as both verification and eval. */
function separationCheck(
  index: ArtifactIndex,
  findings: Finding[],
): void {
  const verificationIds = new Set(
    index.allOfKind("verification_artifact").map((a) => a.id),
  );
  const evalIds = index.allOfKind("execution_eval").map((a) => a.id);

  for (const id of evalIds) {
    if (verificationIds.has(id)) {
      findings.push({
        code: "BDSK-VER-004",
        severity: "warning",
        category: "verification",
        artifact_id: id,
        message: `Artifact '${id}' appears as both verification_artifact and execution_eval`,
        details: { artifact_id: id },
      });
    }
  }
}
