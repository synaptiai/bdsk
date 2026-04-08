import { ArtifactIndex } from "../core/artifact-index.js";
import type { Finding } from "../types/findings.js";
export interface DiscoveryOptions {
    fileExtensions?: string[];
    ignorePaths?: string[];
}
export interface DiscoveryResult {
    index: ArtifactIndex;
    findings: Finding[];
}
export declare function discoverArtifacts(repoRoot: string, artifactsDir?: string, options?: DiscoveryOptions): DiscoveryResult;
//# sourceMappingURL=v1-discovery.d.ts.map