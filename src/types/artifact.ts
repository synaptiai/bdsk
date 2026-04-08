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

// --- Typed accessors for known artifact spec shapes ---

export interface ExecutionPlanSpec {
  objective?: string;
  in_scope_paths?: string[];
  out_of_scope_paths?: string[];
  allowed_operations?: string[];
  forbidden_operations?: string[];
  required_inputs?: {
    behaviors?: string[];
    assumptions?: string[];
    contracts?: string[];
    policies?: string[];
    review_gates?: string[];
  };
  required_outputs?: string[];
  escalation_conditions?: string[];
  completion_criteria?: string[];
}

export interface ReviewGateMetadata {
  gate_class?: "blocking" | "warning" | "manual-review" | "escalation";
  subject?: "scope" | "dependencies" | "contracts" | "tests" | "security" | "architecture" | "other";
}

export interface ExecutionEvalSpec {
  subject_diff?: string;
  subject_gate?: string;
  result?: "pass" | "warn" | "fail" | "escalate";
  findings?: string[];
  evidence?: string[];
}

export interface ExecutionLogSpec {
  consulted_artifacts?: string[];
  steps?: string[];
  emitted_outputs?: string[];
  surfaced_uncertainties?: string[];
  stop_conditions_triggered?: string[];
  final_state?: "completed" | "aborted" | "escalated";
}

export interface AcceptanceDecisionSpec {
  subject_diffs?: string[];
  decision_summary?: string;
  reasons?: string[];
  conditions?: string[];
  residual_risks?: string[];
  approvers?: string[];
}

/** Type-safe accessor for execution plan spec fields. */
export function asExecutionPlanSpec(artifact: ParsedArtifact): ExecutionPlanSpec {
  return artifact.spec as ExecutionPlanSpec;
}

/** Type-safe accessor for review gate metadata. */
export function asReviewGateMetadata(artifact: ParsedArtifact): ReviewGateMetadata {
  return artifact.metadata as ReviewGateMetadata;
}

/** Type-safe accessor for execution eval spec. */
export function asExecutionEvalSpec(artifact: ParsedArtifact): ExecutionEvalSpec {
  return artifact.spec as ExecutionEvalSpec;
}

/** Type-safe accessor for execution log spec. */
export function asExecutionLogSpec(artifact: ParsedArtifact): ExecutionLogSpec {
  return artifact.spec as ExecutionLogSpec;
}

/** Type-safe accessor for acceptance decision spec. */
export function asAcceptanceDecisionSpec(artifact: ParsedArtifact): AcceptanceDecisionSpec {
  return artifact.spec as AcceptanceDecisionSpec;
}
