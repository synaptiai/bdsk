export const ARTIFACT_KINDS = [
  "behavior_spec",
  "assumption_record",
  "contract_artifact",
  "codegen_policy",
  "review_gate",
  "execution_plan",
  "generated_diff",
  "verification_artifact",
  "execution_eval",
  "execution_log",
  "waiver_record",
  "acceptance_decision",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const TRACE_EDGES = [
  "depends_on",
  "derived_from",
  "constrains",
  "implements",
  "proves",
  "evaluates",
  "produced_by",
  "supersedes",
  "escalates_to",
  "waives",
] as const;

export type TraceEdge = (typeof TRACE_EDGES)[number];

export interface TraceRef {
  target_id: string;
  edge: TraceEdge;
}

export interface Trace {
  upstream: TraceRef[];
  downstream: TraceRef[];
}

export interface ApprovalEntry {
  authority_role: string;
  approver: string;
  approved_at: string;
}

export interface ParsedArtifact {
  id: string;
  kind: ArtifactKind;
  schema_version: string;
  status: string;
  title: string;
  owners: string[];
  created_at: string;
  updated_at: string;
  trace: Trace;
  approvals: ApprovalEntry[];
  metadata: Record<string, unknown>;
  spec: Record<string, unknown>;
  source_path: string;
  raw: Record<string, unknown>;
}
