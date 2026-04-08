import { ArtifactIndex } from "../core/artifact-index.js";
import { SchemaRegistry } from "../core/schema-registry.js";
import type { Finding } from "../types/findings.js";

export function validateSchemas(
  index: ArtifactIndex,
  registry: SchemaRegistry,
): Finding[] {
  const findings: Finding[] = [];

  for (const artifact of index.byId.values()) {
    // Check schema_version
    if (artifact.schema_version !== "0.3") {
      findings.push({
        code: "BDSK-SCHEMA-003",
        severity: "error",
        category: "schema",
        artifact_id: artifact.id,
        message: `Unsupported schema_version '${artifact.schema_version}', expected '0.3'`,
        details: { schema_version: artifact.schema_version },
      });
      index.schemaInvalid.add(artifact.id);
    }

    // Validate against kind-specific JSON Schema
    const result = registry.validate(artifact.kind, artifact.raw);
    if (!result.valid) {
      for (const err of result.errors) {
        findings.push({
          code: "BDSK-SCHEMA-002",
          severity: "error",
          category: "schema",
          artifact_id: artifact.id,
          message: `Schema validation failed at ${err.path}: ${err.message}`,
          details: { path: err.path, message: err.message },
        });
      }
      index.schemaInvalid.add(artifact.id);
    }
  }

  return findings;
}
