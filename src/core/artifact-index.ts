import type { ParsedArtifact, ArtifactKind, TraceEdge } from "../types/artifact.js";

export class ArtifactIndex {
  readonly byId: Map<string, ParsedArtifact> = new Map();
  readonly byKind: Map<ArtifactKind, ParsedArtifact[]> = new Map();

  // reverse index: who points TO a given artifact?
  private readonly _incomingUpstream: Map<string, Array<{ from: ParsedArtifact; edge: TraceEdge }>> = new Map();
  private readonly _incomingDownstream: Map<string, Array<{ from: ParsedArtifact; edge: TraceEdge }>> = new Map();

  // set of IDs marked schema-invalid by V2
  readonly schemaInvalid: Set<string> = new Set();

  add(artifact: ParsedArtifact): void {
    this.byId.set(artifact.id, artifact);
    const list = this.byKind.get(artifact.kind) ?? [];
    list.push(artifact);
    this.byKind.set(artifact.kind, list);
  }

  buildReverseIndex(): void {
    this._incomingUpstream.clear();
    this._incomingDownstream.clear();
    for (const artifact of this.byId.values()) {
      for (const ref of artifact.trace.upstream) {
        const list = this._incomingUpstream.get(ref.target_id) ?? [];
        list.push({ from: artifact, edge: ref.edge });
        this._incomingUpstream.set(ref.target_id, list);
      }
      for (const ref of artifact.trace.downstream) {
        const list = this._incomingDownstream.get(ref.target_id) ?? [];
        list.push({ from: artifact, edge: ref.edge });
        this._incomingDownstream.set(ref.target_id, list);
      }
    }
  }

  get(id: string): ParsedArtifact | undefined {
    return this.byId.get(id);
  }

  allOfKind(kind: ArtifactKind): ParsedArtifact[] {
    return this.byKind.get(kind) ?? [];
  }

  /** Artifacts that THIS artifact points to upstream, optionally filtered by edge */
  upstreamOf(id: string, edgeFilter?: TraceEdge): ParsedArtifact[] {
    const artifact = this.byId.get(id);
    if (!artifact) return [];
    return artifact.trace.upstream
      .filter((ref) => !edgeFilter || ref.edge === edgeFilter)
      .map((ref) => this.byId.get(ref.target_id))
      .filter((a): a is ParsedArtifact => a !== undefined);
  }

  /** Artifacts that THIS artifact points to downstream, optionally filtered by edge */
  downstreamOf(id: string, edgeFilter?: TraceEdge): ParsedArtifact[] {
    const artifact = this.byId.get(id);
    if (!artifact) return [];
    return artifact.trace.downstream
      .filter((ref) => !edgeFilter || ref.edge === edgeFilter)
      .map((ref) => this.byId.get(ref.target_id))
      .filter((a): a is ParsedArtifact => a !== undefined);
  }

  /** Artifacts whose trace references point TO this artifact (reverse lookup) */
  incomingRefs(id: string, edgeFilter?: TraceEdge): ParsedArtifact[] {
    const fromUpstream = this._incomingUpstream.get(id) ?? [];
    const fromDownstream = this._incomingDownstream.get(id) ?? [];
    const all = [...fromUpstream, ...fromDownstream];
    const filtered = edgeFilter ? all.filter((r) => r.edge === edgeFilter) : all;
    // deduplicate by artifact id
    const seen = new Set<string>();
    return filtered
      .map((r) => r.from)
      .filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
  }
}
