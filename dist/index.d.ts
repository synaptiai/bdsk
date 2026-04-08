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
import type { ConformanceReport } from "./types/report.js";
export declare const VALIDATOR_VERSION = "1.0.0";
export type Phase = "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8";
export interface ValidateOptions {
    repositoryPath: string;
    artifactsDir?: string;
    schemasDir?: string;
    configPath?: string;
    phases?: Phase[];
    executionFilter?: string[];
    strict?: boolean;
}
export declare function validate(options: ValidateOptions): Promise<ConformanceReport>;
//# sourceMappingURL=index.d.ts.map