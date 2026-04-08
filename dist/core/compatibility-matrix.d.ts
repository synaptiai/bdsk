import type { ArtifactKind, TraceEdge } from "../types/artifact.js";
/**
 * Check whether (sourceKind, edge, targetKind) is valid for the given direction.
 * Returns true if the triple is allowed, false otherwise.
 */
export declare function isCompatible(sourceKind: ArtifactKind, edge: TraceEdge, direction: "upstream" | "downstream", targetKind: ArtifactKind): boolean;
//# sourceMappingURL=compatibility-matrix.d.ts.map