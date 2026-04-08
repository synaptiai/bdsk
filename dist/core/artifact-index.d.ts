import type { ParsedArtifact, ArtifactKind, TraceEdge } from "../types/artifact.js";
export declare class ArtifactIndex {
    readonly byId: Map<string, ParsedArtifact>;
    readonly byKind: Map<ArtifactKind, ParsedArtifact[]>;
    private readonly _incomingUpstream;
    private readonly _incomingDownstream;
    readonly schemaInvalid: Set<string>;
    add(artifact: ParsedArtifact): void;
    buildReverseIndex(): void;
    get(id: string): ParsedArtifact | undefined;
    allOfKind(kind: ArtifactKind): ParsedArtifact[];
    /** Artifacts that THIS artifact points to upstream, optionally filtered by edge */
    upstreamOf(id: string, edgeFilter?: TraceEdge): ParsedArtifact[];
    /** Artifacts that THIS artifact points to downstream, optionally filtered by edge */
    downstreamOf(id: string, edgeFilter?: TraceEdge): ParsedArtifact[];
    /** Artifacts whose trace references point TO this artifact (reverse lookup) */
    incomingRefs(id: string, edgeFilter?: TraceEdge): ParsedArtifact[];
}
//# sourceMappingURL=artifact-index.d.ts.map