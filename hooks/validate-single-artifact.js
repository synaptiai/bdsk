#!/usr/bin/env node
/**
 * BDSK single-artifact schema validator.
 * Called by validate-artifact.sh hook after artifact writes.
 *
 * Usage: node validate-single-artifact.js <artifact-path> <schemas-dir>
 * Exit 0 = valid, Exit 1 = invalid (errors printed to stdout)
 */

import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const [,, artifactPath, schemasDir] = process.argv;

if (!artifactPath || !schemasDir) {
  console.error("Usage: validate-single-artifact.js <artifact-path> <schemas-dir>");
  process.exit(1);
}

// Parse the artifact
let raw;
try {
  const content = readFileSync(resolve(artifactPath), "utf-8");
  raw = parseYaml(content);
} catch (e) {
  console.log(`  Parse error: ${e.message}`);
  process.exit(1);
}

if (!raw || typeof raw !== "object") {
  console.log("  Not a valid YAML object");
  process.exit(1);
}

const kind = raw.kind;
if (!kind || typeof kind !== "string") {
  console.log("  Missing or invalid 'kind' field");
  process.exit(1);
}

// Load schemas
const resolvedSchemas = resolve(schemasDir);
const commonPath = join(resolvedSchemas, "common.json");
const kindSchemaPath = join(resolvedSchemas, `${kind}.json`);

if (!existsSync(commonPath)) {
  console.log(`  Schema not found: common.json in ${resolvedSchemas}`);
  process.exit(1);
}

if (!existsSync(kindSchemaPath)) {
  // Unknown kind — not a BDSK artifact, skip validation
  process.exit(0);
}

// Set up Ajv
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
addFormats(ajv);

const commonSchema = JSON.parse(readFileSync(commonPath, "utf-8"));
ajv.addSchema(commonSchema, commonSchema.$id ?? "common.json");

const kindSchema = JSON.parse(readFileSync(kindSchemaPath, "utf-8"));
const validate = ajv.compile(kindSchema);

// Validate
const valid = validate(raw);

if (valid) {
  process.exit(0);
}

// Format errors
const errors = validate.errors || [];
for (const err of errors) {
  const path = err.instancePath || "/";
  const msg = err.message || "Unknown error";
  const params = err.params ? ` (${JSON.stringify(err.params)})` : "";
  console.log(`  ${path}: ${msg}${params}`);
}

process.exit(1);
