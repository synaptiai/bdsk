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
