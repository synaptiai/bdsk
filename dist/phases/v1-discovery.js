import { readdirSync, readFileSync } from "fs";
import { join, resolve, extname, relative } from "path";
import { parse as parseYaml, parseAllDocuments } from "yaml";
import { minimatch } from "../core/minimatch.js";
import { ArtifactIndex } from "../core/artifact-index.js";
import { ARTIFACT_KINDS } from "../types/artifact.js";
const DEFAULT_EXTENSIONS = new Set([".yaml", ".yml", ".json"]);
const VALID_KINDS = new Set(ARTIFACT_KINDS);
function walkDir(dir, extensions) {
    const results = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isSymbolicLink())
            continue; // skip symlinks for safety
        if (entry.isDirectory()) {
            results.push(...walkDir(full, extensions));
        }
        else if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) {
            results.push(full);
        }
    }
    return results;
}
export function discoverArtifacts(repoRoot, artifactsDir = "artifacts/", options) {
    const index = new ArtifactIndex();
    const findings = [];
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
    let files;
    try {
        files = walkDir(artDir, extensions).sort(); // sort for deterministic ordering
    }
    catch (e) {
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
        let parsed;
        try {
            const content = readFileSync(filePath, "utf-8");
            // Reject multi-document YAML (not supported in v1)
            const docs = parseAllDocuments(content);
            if (docs.length > 1) {
                findings.push({
                    code: "BDSK-SCHEMA-002",
                    severity: "error",
                    category: "schema",
                    artifact_id: null,
                    message: `Multi-document YAML not supported: ${filePath} contains ${docs.length} documents`,
                    details: { path: filePath, document_count: docs.length },
                });
                continue;
            }
            parsed = parseYaml(content);
        }
        catch (e) {
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
        if (!parsed || typeof parsed !== "object")
            continue;
        // Skip files without a kind field (not BDSK artifacts)
        if (!("kind" in parsed))
            continue;
        const kind = parsed.kind;
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
        const id = parsed.id;
        // Check for duplicate IDs
        if (index.byId.has(id)) {
            findings.push({
                code: "BDSK-SCHEMA-001",
                severity: "error",
                category: "schema",
                artifact_id: id,
                message: `Duplicate artifact ID '${id}'`,
                details: { path: filePath, existing_path: index.byId.get(id).source_path },
            });
            continue;
        }
        // Build ParsedArtifact
        const trace = {
            upstream: Array.isArray(parsed.trace?.upstream)
                ? parsed.trace.upstream
                : [],
            downstream: Array.isArray(parsed.trace?.downstream)
                ? parsed.trace.downstream
                : [],
        };
        const artifact = {
            id,
            kind: kind,
            schema_version: parsed.schema_version ?? "",
            status: parsed.status ?? "",
            title: parsed.title ?? "",
            owners: parsed.owners ?? [],
            created_at: parsed.created_at ?? "",
            updated_at: parsed.updated_at ?? "",
            trace,
            approvals: parsed.approvals ?? [],
            metadata: parsed.metadata ?? {},
            spec: parsed.spec ?? {},
            source_path: filePath,
            raw: parsed,
        };
        index.add(artifact);
    }
    // Build reverse index
    index.buildReverseIndex();
    return { index, findings };
}
//# sourceMappingURL=v1-discovery.js.map