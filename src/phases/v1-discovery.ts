import { readdirSync, readFileSync } from "fs";
import { join, resolve, extname, relative } from "path";
import { parse as parseYaml } from "yaml";
import { minimatch } from "../core/minimatch.js";
import { ArtifactIndex } from "../core/artifact-index.js";
import { ARTIFACT_KINDS, type ArtifactKind, type ParsedArtifact, type Trace } from "../types/artifact.js";
import type { Finding } from "../types/findings.js";

const DEFAULT_EXTENSIONS = new Set([".yaml", ".yml", ".json"]);
const VALID_KINDS = new Set<string>(ARTIFACT_KINDS);

export interface DiscoveryOptions {
  fileExtensions?: string[];
  ignorePaths?: string[];
}

function walkDir(dir: string, extensions: Set<string>): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue; // skip symlinks for safety
    if (entry.isDirectory()) {
      results.push(...walkDir(full, extensions));
    } else if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

export interface DiscoveryResult {
  index: ArtifactIndex;
  findings: Finding[];
}

export function discoverArtifacts(
  repoRoot: string,
  artifactsDir: string = "artifacts/",
  options?: DiscoveryOptions,
): DiscoveryResult {
  const index = new ArtifactIndex();
  const findings: Finding[] = [];

  const extensions = options?.fileExtensions
    ? new Set(options.fileExtensions.map((e) => e.startsWith(".") ? e : `.${e}`))
    : DEFAULT_EXTENSIONS;

  const ignorePaths = options?.ignorePaths ?? [];

  const artDir = resolve(repoRoot, artifactsDir);

  // Path traversal protection: ensure artifact dir is within repo root
  const resolvedRoot = resolve(repoRoot);
  if (!artDir.startsWith(resolvedRoot)) {
    findings.push({
      code: "BDSK-SCHEMA-002",
      severity: "error",
      category: "schema",
      artifact_id: null,
      message: `Artifact directory '${artifactsDir}' resolves outside repository root`,
      details: { artifacts_dir: artifactsDir, resolved: artDir, repo_root: resolvedRoot },
    });
    return { index, findings };
  }

  let files: string[];
  try {
    files = walkDir(artDir, extensions).sort(); // sort for deterministic ordering
  } catch (e) {
    findings.push({
      code: "BDSK-SCHEMA-002",
      severity: "error",
      category: "schema",
      artifact_id: null,
      message: `Cannot read artifact directory '${artDir}': ${e instanceof Error ? e.message : String(e)}`,
      details: { artifacts_dir: artDir },
    });
    return { index, findings };
  }

  for (const filePath of files) {
    // Apply ignore_paths filter
    const relPath = relative(resolvedRoot, filePath);
    if (ignorePaths.some((pattern) => minimatch(relPath, pattern))) {
      continue;
    }

    // Parse YAML/JSON
    let parsed: Record<string, unknown>;
    try {
      const content = readFileSync(filePath, "utf-8");
      parsed = parseYaml(content) as Record<string, unknown>;
    } catch (e) {
      findings.push({
        code: "BDSK-SCHEMA-002",
        severity: "error",
        category: "schema",
        artifact_id: null,
        message: `YAML parse failure: ${filePath}`,
        details: { path: filePath, error: String(e) },
      });
      continue;
    }

    if (!parsed || typeof parsed !== "object") continue;

    // Skip files without a kind field (not BDSK artifacts)
    if (!("kind" in parsed)) continue;

    const kind = parsed.kind as string;

    // Validate kind
    if (!VALID_KINDS.has(kind)) {
      findings.push({
        code: "BDSK-SCHEMA-002",
        severity: "error",
        category: "schema",
        artifact_id: null,
        message: `Unrecognized artifact kind '${kind}'`,
        details: { path: filePath, kind },
      });
      continue;
    }

    // Check for id
    if (!parsed.id || typeof parsed.id !== "string") {
      findings.push({
        code: "BDSK-SCHEMA-002",
        severity: "error",
        category: "schema",
        artifact_id: null,
        message: `Artifact missing required 'id' field`,
        details: { path: filePath },
      });
      continue;
    }

    const id = parsed.id as string;

    // Check for duplicate IDs
    if (index.byId.has(id)) {
      findings.push({
        code: "BDSK-SCHEMA-001",
        severity: "error",
        category: "schema",
        artifact_id: id,
        message: `Duplicate artifact ID '${id}'`,
        details: { path: filePath, existing_path: index.byId.get(id)!.source_path },
      });
      continue;
    }

    // Build ParsedArtifact
    const trace: Trace = {
      upstream: Array.isArray((parsed.trace as Record<string, unknown>)?.upstream)
        ? (parsed.trace as Record<string, unknown>).upstream as Trace["upstream"]
        : [],
      downstream: Array.isArray((parsed.trace as Record<string, unknown>)?.downstream)
        ? (parsed.trace as Record<string, unknown>).downstream as Trace["downstream"]
        : [],
    };

    const artifact: ParsedArtifact = {
      id,
      kind: kind as ArtifactKind,
      schema_version: (parsed.schema_version as string) ?? "",
      status: (parsed.status as string) ?? "",
      title: (parsed.title as string) ?? "",
      owners: (parsed.owners as string[]) ?? [],
      created_at: (parsed.created_at as string) ?? "",
      updated_at: (parsed.updated_at as string) ?? "",
      trace,
      approvals: (parsed.approvals as ParsedArtifact["approvals"]) ?? [],
      metadata: (parsed.metadata as Record<string, unknown>) ?? {},
      spec: (parsed.spec as Record<string, unknown>) ?? {},
      source_path: filePath,
      raw: parsed,
    };

    index.add(artifact);
  }

  // Build reverse index
  index.buildReverseIndex();

  return { index, findings };
}
