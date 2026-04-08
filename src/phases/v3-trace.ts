import { ArtifactIndex } from "../core/artifact-index.js";
import { isCompatible } from "../core/compatibility-matrix.js";
import { TRACE_EDGES, type ArtifactKind, type TraceEdge } from "../types/artifact.js";
import type { Finding } from "../types/findings.js";

const VALID_EDGES = new Set<string>(TRACE_EDGES);

export function validateTraces(index: ArtifactIndex): Finding[] {
  const findings: Finding[] = [];

  for (const artifact of index.byId.values()) {
    if (index.schemaInvalid.has(artifact.id)) continue;

    const trace = artifact.raw.trace as Record<string, unknown> | undefined;

    // TR-1: trace must exist with upstream and downstream arrays
    if (
      !trace ||
      typeof trace !== "object" ||
      !Array.isArray(trace.upstream) ||
      !Array.isArray(trace.downstream)
    ) {
      findings.push({
        code: "BDSK-TRACE-001",
        severity: "error",
        category: "trace",
        artifact_id: artifact.id,
        message: "Malformed trace object: missing upstream or downstream array",
        details: {},
      });
      continue;
    }

    // Check each trace reference in both arrays
    const checkRefs = (refs: unknown[], direction: "upstream" | "downstream") => {
      if (!Array.isArray(refs)) return;
      for (const ref of refs) {
        if (!ref || typeof ref !== "object") continue;
        const r = ref as Record<string, unknown>;

        // TR-2: check edge is canonical
        const edge = r.edge as string;
        if (!edge || !VALID_EDGES.has(edge)) {
          findings.push({
            code: "BDSK-TRACE-002",
            severity: "error",
            category: "trace",
            artifact_id: artifact.id,
            message: `Invalid trace edge '${edge}' (not in canonical 10)`,
            details: { edge, direction },
          });
        }

        // TR-3: check for extra fields (only target_id and edge allowed)
        const keys = Object.keys(r);
        const extraKeys = keys.filter((k) => k !== "target_id" && k !== "edge");
        if (extraKeys.length > 0) {
          findings.push({
            code: "BDSK-TRACE-003",
            severity: "error",
            category: "trace",
            artifact_id: artifact.id,
            message: `Extra fields in trace reference: ${extraKeys.join(", ")}`,
            details: { extra_fields: extraKeys, direction },
          });
        }

        // Edge-kind compatibility (only if target resolves — otherwise RI-1 catches it)
        if (edge && VALID_EDGES.has(edge) && r.target_id) {
          const target = index.get(r.target_id as string);
          if (target) {
            if (!isCompatible(artifact.kind, edge as TraceEdge, direction, target.kind as ArtifactKind)) {
              findings.push({
                code: "BDSK-TRACE-004",
                severity: "error",
                category: "trace",
                artifact_id: artifact.id,
                message: `Edge-kind incompatible: (${artifact.kind}, ${edge}, ${target.kind}) in ${direction}`,
                details: {
                  source_kind: artifact.kind,
                  edge,
                  target_kind: target.kind,
                  target_id: target.id,
                  direction,
                },
              });
            }
          }
        }
      }
    };

    checkRefs(trace.upstream as unknown[], "upstream");
    checkRefs(trace.downstream as unknown[], "downstream");
  }

  return findings;
}
