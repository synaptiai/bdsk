import type { ArtifactKind } from "./artifact.js";
import type { Finding } from "./findings.js";

export type RepositoryOutcome = "conformant" | "non_conformant";

export type ExecutionOutcome =
  | "accepted"
  | "conditionally_accepted"
  | "rejected"
  | "indeterminate";

export interface ConformanceReport {
  validator_version: string;
  spec_version: string;
  repository_outcome: RepositoryOutcome;
  summary: {
    artifact_count: number;
    schema_failures: number;
    warnings: number;
    errors: number;
  };
  artifacts_scanned: Array<{
    id: string;
    kind: ArtifactKind;
    status: string;
  }>;
  execution_results: Array<{
    execution_plan_id: string;
    outcome: ExecutionOutcome;
    blocking_failures: Finding[];
    warnings: Finding[];
    evidence: {
      verification_artifacts: string[];
      execution_evals: string[];
      waivers: string[];
    };
  }>;
  findings: Finding[];
}
