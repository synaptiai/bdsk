export type { ParsedArtifact, ArtifactKind, TraceEdge, Trace, TraceRef, ApprovalEntry } from "./types/artifact.js";
export type { Finding, FindingCategory, Severity } from "./types/findings.js";
export type { ConformanceReport, RepositoryOutcome, ExecutionOutcome } from "./types/report.js";

export { ArtifactIndex } from "./core/artifact-index.js";
export { SchemaRegistry } from "./core/schema-registry.js";
export { isCompatible } from "./core/compatibility-matrix.js";

export { discoverArtifacts } from "./phases/v1-discovery.js";
export { validateSchemas } from "./phases/v2-schema.js";
export { validateTraces } from "./phases/v3-trace.js";
export { validateReferentialIntegrity } from "./phases/v4-referential.js";
export { validateAuthority } from "./phases/v5-authority.js";
export { validateExecutionConformance } from "./phases/v6-execution.js";
export { validateVerificationCoverage } from "./phases/v7-verification.js";
export { validateAcceptance } from "./phases/v8-acceptance.js";

import { resolve, join } from "path";
import { discoverArtifacts } from "./phases/v1-discovery.js";
import { validateSchemas } from "./phases/v2-schema.js";
import { validateTraces } from "./phases/v3-trace.js";
import { validateReferentialIntegrity } from "./phases/v4-referential.js";
import { validateAuthority } from "./phases/v5-authority.js";
import { validateExecutionConformance } from "./phases/v6-execution.js";
import { validateVerificationCoverage } from "./phases/v7-verification.js";
import { validateAcceptance } from "./phases/v8-acceptance.js";
import { computeExecutionResult } from "./phases/v8-acceptance.js";
import { SchemaRegistry } from "./core/schema-registry.js";
import { loadConfig } from "./config.js";
import { mergeAuthorityConfig } from "./core/authority-matrix.js";
import type { Finding } from "./types/findings.js";
import type { ConformanceReport } from "./types/report.js";

export const VALIDATOR_VERSION = "1.0.0";

export type Phase = "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8";
const ALL_PHASES: Phase[] = ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"];

export interface ValidateOptions {
  repositoryPath: string;
  artifactsDir?: string;
  schemasDir?: string;
  configPath?: string;
  phases?: Phase[];
  executionFilter?: string[];
  strict?: boolean;
}

export async function validate(options: ValidateOptions): Promise<ConformanceReport> {
  const repoRoot = resolve(options.repositoryPath);
  const config = loadConfig(repoRoot, options.configPath);
  const phases = new Set(options.phases ?? ALL_PHASES);
  const artifactsDir = options.artifactsDir ?? config.artifacts_dir;

  const allFindings: Finding[] = [];

  // V1: Discovery — always collect findings (V1 is infrastructure, not optional)
  const { index, findings: v1Findings } = discoverArtifacts(repoRoot, artifactsDir, {
    fileExtensions: config.file_extensions,
    ignorePaths: config.ignore_paths,
  });
  allFindings.push(...v1Findings);

  // V2: Schema validation
  if (phases.has("v2")) {
    const schemasDir = options.schemasDir ?? config.schemas_dir ?? join(repoRoot, "schemas");
    const registry = new SchemaRegistry();
    try {
      registry.loadFromDirectory(schemasDir);
      allFindings.push(...validateSchemas(index, registry));
    } catch (e) {
      allFindings.push({
        code: "BDSK-SCHEMA-002",
        severity: "error",
        category: "schema",
        artifact_id: null,
        message: `Failed to load schemas: ${e}`,
        details: { error: String(e) },
      });
    }
  }

  // V3: Trace validation
  if (phases.has("v3")) {
    allFindings.push(...validateTraces(index));
  }

  // V4: Referential integrity
  if (phases.has("v4")) {
    allFindings.push(...validateReferentialIntegrity(index));
  }

  // V5: Authority validation
  if (phases.has("v5")) {
    let authConfig = undefined;
    if (Object.keys(config.authority).length > 0) {
      const { config: merged, violations } = mergeAuthorityConfig(config.authority);
      if (violations.length > 0) {
        for (const v of violations) {
          allFindings.push({
            code: "BDSK-AUTH-001",
            severity: "error",
            category: "authority",
            artifact_id: null,
            message: v,
            details: {},
          });
        }
      } else {
        authConfig = merged;
      }
    }
    allFindings.push(...validateAuthority(index, authConfig));
  }

  // V6: Execution conformance
  if (phases.has("v6")) {
    allFindings.push(...validateExecutionConformance(index));
  }

  // V7: Verification coverage
  if (phases.has("v7")) {
    allFindings.push(...validateVerificationCoverage(index));
  }

  // V8: Acceptance
  if (phases.has("v8")) {
    allFindings.push(...validateAcceptance(index, allFindings));
  }

  // Build report
  // Apply strict mode: promote warnings to errors
  const finalFindings = options.strict
    ? allFindings.map((f) => f.severity === "warning" ? { ...f, severity: "error" as const } : f)
    : allFindings;

  const errors = finalFindings.filter((f) => f.severity === "error");
  const warnings = finalFindings.filter((f) => f.severity === "warning");
  const schemaFailures = finalFindings.filter((f) => f.category === "schema" && f.severity === "error");

  const executionPlans = index.allOfKind("execution_plan")
    .filter((ep) => !options.executionFilter || options.executionFilter.includes(ep.id));

  const executionResults = executionPlans.map((ep) =>
    computeExecutionResult(index, ep.id, allFindings),
  );

  const report: ConformanceReport = {
    validator_version: VALIDATOR_VERSION,
    spec_version: "0.3",
    repository_outcome: errors.length === 0 ? "conformant" : "non_conformant",
    summary: {
      artifact_count: index.byId.size,
      schema_failures: schemaFailures.length,
      warnings: warnings.length,
      errors: errors.length,
    },
    artifacts_scanned: Array.from(index.byId.values()).map((a) => ({
      id: a.id,
      kind: a.kind,
      status: a.status,
    })),
    execution_results: executionResults.map((er, i) => ({
      execution_plan_id: executionPlans[i].id,
      ...er,
    })),
    findings: finalFindings,
  };

  return report;
}
