export class ArtifactIndex {
    byId = new Map();
    byKind = new Map();
    // reverse index: who points TO a given artifact?
    _incomingUpstream = new Map();
    _incomingDownstream = new Map();
    // set of IDs marked schema-invalid by V2
    schemaInvalid = new Set();
    add(artifact) {
        this.byId.set(artifact.id, artifact);
        const list = this.byKind.get(artifact.kind) ?? [];
        list.push(artifact);
        this.byKind.set(artifact.kind, list);
    }
    buildReverseIndex() {
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
    get(id) {
        return this.byId.get(id);
    }
    allOfKind(kind) {
        return this.byKind.get(kind) ?? [];
    }
    /** Artifacts that THIS artifact points to upstream, optionally filtered by edge */
    upstreamOf(id, edgeFilter) {
        const artifact = this.byId.get(id);
        if (!artifact)
            return [];
        return artifact.trace.upstream
            .filter((ref) => !edgeFilter || ref.edge === edgeFilter)
            .map((ref) => this.byId.get(ref.target_id))
            .filter((a) => a !== undefined);
    }
    /** Artifacts that THIS artifact points to downstream, optionally filtered by edge */
    downstreamOf(id, edgeFilter) {
        const artifact = this.byId.get(id);
        if (!artifact)
            return [];
        return artifact.trace.downstream
            .filter((ref) => !edgeFilter || ref.edge === edgeFilter)
            .map((ref) => this.byId.get(ref.target_id))
            .filter((a) => a !== undefined);
    }
    /** Artifacts whose trace references point TO this artifact (reverse lookup) */
    incomingRefs(id, edgeFilter) {
        const fromUpstream = this._incomingUpstream.get(id) ?? [];
        const fromDownstream = this._incomingDownstream.get(id) ?? [];
        const all = [...fromUpstream, ...fromDownstream];
        const filtered = edgeFilter ? all.filter((r) => r.edge === edgeFilter) : all;
        // deduplicate by artifact id
        const seen = new Set();
        return filtered
            .map((r) => r.from)
            .filter((a) => {
            if (seen.has(a.id))
                return false;
            seen.add(a.id);
            return true;
        });
    }
}
//# sourceMappingURL=artifact-index.js.map