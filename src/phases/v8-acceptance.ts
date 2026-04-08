import { ArtifactIndex } from "../core/artifact-index.js";
import { asAcceptanceDecisionSpec } from "../types/artifact.js";
import type { Finding } from "../types/findings.js";
import type { ExecutionOutcome } from "../types/report.js";

const BLOCKING_CODES = new Set([
  "BDSK-VER-001", "BDSK-VER-003", "BDSK-VER-002",
  "BDSK-GATE-001", "BDSK-GATE-002", "BDSK-GATE-003",
  "BDSK-EXEC-003",
  "BDSK-REF-003", "BDSK-REF-004",
  "BDSK-AUTH-001", "BDSK-AUTH-002", "BDSK-AUTH-003",
]);

export function validateAcceptance(
  index: ArtifactIndex,
  priorFindings: Finding[],
): Finding[] {
  const findings: Finding[] = [];

  for (const ad of index.allOfKind("acceptance_decision")) {
    if (index.schemaInvalid.has(ad.id)) continue;

    const recordedOutcome = ad.metadata.outcome as string | undefined;
    const computed = computeOutcome(index, ad.id, priorFindings);

    if (recordedOutcome && recordedOutcome !== computed.outcome) {
      findings.push({
        code: "BDSK-ACC-002",
        severity: "error",
        category: "acceptance",
        artifact_id: ad.id,
        message: `Recorded outcome '${recordedOutcome}' disagrees with computed outcome '${computed.outcome}'`,
        details: {
          recorded: recordedOutcome,
          computed: computed.outcome,
          blocking_count: computed.blockingFindings.length,
          warning_count: computed.warningFindings.length,
        },
      });
    }

    if (recordedOutcome === "accepted" && computed.blockingFindings.length > 0) {
      findings.push({
        code: "BDSK-ACC-004",
        severity: "error",
        category: "acceptance",
        artifact_id: ad.id,
        message: `Accepted decision contains ${computed.blockingFindings.length} unresolved blocking failure(s)`,
        details: {
          blocking_codes: computed.blockingFindings.map((f) => f.code),
        },
      });
    }

    if (computed.outcome === "conditionally_accepted") {
      const conditions = asAcceptanceDecisionSpec(ad).conditions;
      if (!conditions || conditions.length === 0) {
        findings.push({
          code: "BDSK-ACC-003",
          severity: "warning",
          category: "acceptance",
          artifact_id: ad.id,
          message: "Conditionally accepted but conditions list is empty",
          details: {},
        });
      }
    }
  }

  return findings;
}

interface ComputedOutcome {
  outcome: ExecutionOutcome;
  blockingFindings: Finding[];
  warningFindings: Finding[];
}

function computeOutcome(
  index: ArtifactIndex,
  adId: string,
  priorFindings: Finding[],
): ComputedOutcome {
  // Collect all findings that are relevant to the artifacts this acceptance covers
  const ad = index.get(adId);
  if (!ad) return { outcome: "indeterminate", blockingFindings: [], warningFindings: [] };
  const subjectDiffs = asAcceptanceDecisionSpec(ad).subject_diffs ?? [];

  // Find the execution plan(s) related to these diffs
  const relatedEpIds = new Set<string>();
  for (const diffId of subjectDiffs) {
    const diff = index.get(diffId);
    if (!diff) continue;
    for (const ref of diff.trace.upstream) {
      if (ref.edge === "produced_by") {
        relatedEpIds.add(ref.target_id);
      }
    }
  }

  // Collect blocking and warning findings for related artifacts only
  // Exclude global findings (artifact_id === null) to avoid unrelated errors
  // causing all acceptance decisions to be rejected
  const relatedIds = new Set([...subjectDiffs, ...relatedEpIds]);
  const blockingFindings = priorFindings.filter(
    (f) => f.severity === "error" && BLOCKING_CODES.has(f.code) &&
      f.artifact_id !== null && relatedIds.has(f.artifact_id),
  );
  const warningFindings = priorFindings.filter(
    (f) => f.severity === "warning" &&
      f.artifact_id !== null && relatedIds.has(f.artifact_id),
  );

  let outcome: ExecutionOutcome;
  if (blockingFindings.length === 0 && warningFindings.length === 0) {
    outcome = "accepted";
  } else if (blockingFindings.length === 0 && warningFindings.length > 0) {
    outcome = "conditionally_accepted";
  } else {
    outcome = "rejected";
  }

  return { outcome, blockingFindings, warningFindings };
}

/** Compute execution result for a specific execution plan (used by report builder). */
export function computeExecutionResult(
  index: ArtifactIndex,
  epId: string,
  allFindings: Finding[],
): {
  outcome: ExecutionOutcome;
  blocking_failures: Finding[];
  warnings: Finding[];
  evidence: { verification_artifacts: string[]; execution_evals: string[]; waivers: string[] };
} {
  const ep = index.get(epId);
  if (!ep) {
    return {
      outcome: "indeterminate",
      blocking_failures: [],
      warnings: [],
      evidence: { verification_artifacts: [], execution_evals: [], waivers: [] },
    };
  }

  const epFindings = allFindings.filter(
    (f) => f.artifact_id === epId,
  );
  const blocking = epFindings.filter((f) => f.severity === "error" && BLOCKING_CODES.has(f.code));
  const warnings = epFindings.filter((f) => f.severity === "warning");

  // Gather evidence
  const verificationArtifacts = index.allOfKind("verification_artifact")
    .filter((v) => v.trace.upstream.some((r) =>
      r.edge === "proves" && index.get(r.target_id)?.kind === "behavior_spec",
    ))
    .map((v) => v.id);

  const executionEvals = index.allOfKind("execution_eval")
    .filter((ee) => ee.trace.upstream.some((r) => r.target_id === epId))
    .map((ee) => ee.id);

  const waivers = index.allOfKind("waiver_record")
    .filter((w) => w.status === "approved")
    .map((w) => w.id);

  let outcome: ExecutionOutcome;
  if (blocking.length === 0 && warnings.length === 0) {
    outcome = "accepted";
  } else if (blocking.length === 0) {
    outcome = "conditionally_accepted";
  } else {
    outcome = "rejected";
  }

  return {
    outcome,
    blocking_failures: blocking,
    warnings,
    evidence: { verification_artifacts: verificationArtifacts, execution_evals: executionEvals, waivers },
  };
}
