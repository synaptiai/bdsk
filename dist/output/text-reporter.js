export function formatText(report, verbose = false) {
    const lines = [];
    lines.push(`BDSK Validator v${report.validator_version} | Spec v${report.spec_version}`);
    lines.push("");
    lines.push(`Repository: ${report.repository_path}`);
    lines.push(`Artifacts:  ${report.summary.artifact_count} scanned, ${report.summary.artifact_count - report.summary.schema_failures} valid, ${report.summary.schema_failures} errors`);
    lines.push("");
    if (report.execution_results.length > 0) {
        lines.push("Executions:");
        for (const er of report.execution_results) {
            const suffix = er.blocking_failures.length > 0
                ? ` (${er.blocking_failures.length} blocking failure${er.blocking_failures.length > 1 ? "s" : ""})`
                : "";
            lines.push(`  ${er.execution_plan_id}  ${er.outcome.toUpperCase()}${suffix}`);
        }
        lines.push("");
    }
    const errors = report.findings.filter((f) => f.severity === "error");
    const warnings = report.findings.filter((f) => f.severity === "warning");
    lines.push(`Findings (${report.findings.length} total: ${errors.length} errors, ${warnings.length} warnings):`);
    if (report.findings.length === 0) {
        lines.push("  (none)");
    }
    else {
        for (const f of report.findings) {
            const sev = f.severity === "error" ? "ERROR  " : "WARNING";
            const aid = f.artifact_id ? ` artifact ${f.artifact_id}:` : "";
            lines.push(`  ${sev} ${f.code.padEnd(16)}${aid} ${f.message}`);
            if (verbose && Object.keys(f.details).length > 0) {
                lines.push(`         ${JSON.stringify(f.details)}`);
            }
        }
    }
    lines.push("");
    lines.push(`Repository outcome: ${report.repository_outcome === "conformant" ? "CONFORMANT" : "NON-CONFORMANT"}`);
    return lines.join("\n");
}
//# sourceMappingURL=text-reporter.js.map