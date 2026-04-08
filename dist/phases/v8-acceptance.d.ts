import { ArtifactIndex } from "../core/artifact-index.js";
import type { Finding } from "../types/findings.js";
import type { ExecutionOutcome } from "../types/report.js";
export declare function validateAcceptance(index: ArtifactIndex, priorFindings: Finding[]): Finding[];
/** Compute execution result for a specific execution plan (used by report builder). */
export declare function computeExecutionResult(index: ArtifactIndex, epId: string, allFindings: Finding[]): {
    outcome: ExecutionOutcome;
    blocking_failures: Finding[];
    warnings: Finding[];
    evidence: {
        verification_artifacts: string[];
        execution_evals: string[];
        waivers: string[];
    };
};
//# sourceMappingURL=v8-acceptance.d.ts.map