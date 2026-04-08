import { describe, test, expect } from "bun:test";
import { validate } from "../../src/index.js";
import { join } from "path";

const FIXTURES = join(import.meta.dir, "..", "fixtures");
const SCHEMAS = join(import.meta.dir, "..", "..", "schemas");

describe("Full pipeline integration", () => {
  test("conformant repository passes all checks", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "conformant"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
    });

    expect(report.repository_outcome).toBe("conformant");
    expect(report.summary.errors).toBe(0);
    expect(report.summary.artifact_count).toBeGreaterThanOrEqual(7);
    expect(report.findings.filter((f) => f.severity === "error")).toHaveLength(0);
  });

  test("duplicate IDs produce BDSK-SCHEMA-001", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "duplicate-ids"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
    });

    const dupes = report.findings.filter((f) => f.code === "BDSK-SCHEMA-001");
    expect(dupes.length).toBeGreaterThanOrEqual(1);
    expect(dupes[0].severity).toBe("error");
    expect(dupes[0].artifact_id).toBe("BS-login-001");
  });

  test("missing references produce BDSK-REF-001", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "missing-refs"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
    });

    const missing = report.findings.filter((f) => f.code === "BDSK-REF-001");
    expect(missing.length).toBeGreaterThanOrEqual(1);
    expect(missing[0].severity).toBe("error");
    expect(missing[0].message).toContain("BS-nonexistent-999");
  });

  test("bad traces produce schema errors (invalid edge caught by JSON Schema)", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "bad-traces"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
    });

    // The invalid edge value is caught by JSON Schema validation in V2
    // because the trace schema constrains edge to the canonical 10 values
    const schemaErrors = report.findings.filter(
      (f) => f.code === "BDSK-SCHEMA-002" && f.artifact_id === "BS-bad-trace-001",
    );
    expect(schemaErrors.length).toBeGreaterThanOrEqual(1);
    expect(report.repository_outcome).toBe("non_conformant");
  });

  test("phase filtering limits which checks run", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "missing-refs"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
      phases: ["v1"],
    });

    // V1 only — no REF errors since V4 didn't run
    const refErrors = report.findings.filter((f) => f.code === "BDSK-REF-001");
    expect(refErrors).toHaveLength(0);
  });

  test("strict mode treats warnings as errors", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "conformant"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
      strict: true,
    });

    // All findings should be severity: error in strict mode
    for (const f of report.findings) {
      expect(f.severity).toBe("error");
    }
  });

  // --- V5: Authority validation ---

  test("authority violations produce BDSK-AUTH-001", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "authority-violations"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
    });

    const authErrors = report.findings.filter((f) => f.code === "BDSK-AUTH-001");
    expect(authErrors.length).toBeGreaterThanOrEqual(1);
    // 'observer' role should not satisfy behavior_spec approval
    expect(authErrors[0].message).toContain("authority role");
  });

  // --- V6: Execution conformance ---

  test("blocking gate failure produces BDSK-GATE-001", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "gate-failures"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
    });

    const gateErrors = report.findings.filter((f) => f.code === "BDSK-GATE-001");
    expect(gateErrors.length).toBeGreaterThanOrEqual(1);
    expect(gateErrors[0].severity).toBe("error");
    expect(gateErrors[0].message).toContain("RG-security-001");
  });

  test("stop condition breach produces BDSK-EXEC-003", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "stop-condition-breach"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
    });

    const stopErrors = report.findings.filter((f) => f.code === "BDSK-EXEC-003");
    expect(stopErrors.length).toBeGreaterThanOrEqual(1);
    expect(stopErrors[0].message).toContain("token_limit_exceeded");
  });

  // --- V7: Verification coverage ---

  test("expired waiver produces BDSK-WAIVER-002", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "expired-waiver"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
    });

    const waiverWarnings = report.findings.filter((f) => f.code === "BDSK-WAIVER-002");
    expect(waiverWarnings.length).toBeGreaterThanOrEqual(1);
    expect(waiverWarnings[0].severity).toBe("warning");
  });

  // --- V8: Acceptance validation ---

  test("acceptance mismatch produces BDSK-ACC-001", async () => {
    const report = await validate({
      repositoryPath: join(FIXTURES, "acceptance-mismatch"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
    });

    // Acceptance without subject_diffs or evidence
    const accErrors = report.findings.filter((f) => f.code === "BDSK-ACC-001");
    expect(accErrors.length).toBeGreaterThanOrEqual(1);
  });

  // --- Output formats ---

  test("YAML and JSON output formats produce valid output", async () => {
    const { formatYaml } = await import("../../src/output/yaml-reporter.js");
    const { formatJson } = await import("../../src/output/json-reporter.js");
    const { formatText } = await import("../../src/output/text-reporter.js");

    const report = await validate({
      repositoryPath: join(FIXTURES, "conformant"),
      artifactsDir: ".",
      schemasDir: SCHEMAS,
    });

    const yaml = formatYaml(report);
    expect(yaml).toContain("repository_outcome");

    const json = formatJson(report);
    const parsed = JSON.parse(json);
    expect(parsed.repository_outcome).toBe("conformant");

    const text = formatText(report);
    expect(text).toContain("CONFORMANT");
  });
});
