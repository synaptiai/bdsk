export type FindingCategory = "schema" | "trace" | "reference" | "authority" | "execution" | "gate" | "verification" | "waiver" | "acceptance";
export type Severity = "error" | "warning";
export interface Finding {
    code: string;
    severity: Severity;
    category: FindingCategory;
    artifact_id: string | null;
    message: string;
    details: Record<string, unknown>;
}
//# sourceMappingURL=findings.d.ts.map