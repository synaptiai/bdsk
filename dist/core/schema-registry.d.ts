import type { ArtifactKind } from "../types/artifact.js";
export declare class SchemaRegistry {
    private ajv;
    private validators;
    constructor();
    /**
     * Load all schemas from a directory. Expects common.json + 12 kind-specific schemas.
     * If schemasDir is not provided, uses the bundled schemas from the repo.
     */
    loadFromDirectory(schemasDir: string): void;
    /** Validate an artifact's raw content against its kind-specific schema. */
    validate(kind: ArtifactKind, raw: Record<string, unknown>): {
        valid: boolean;
        errors: Array<{
            path: string;
            message: string;
        }>;
    };
    /** Get the default bundled schemas directory (relative to repo root). */
    static bundledSchemasDir(): string;
}
//# sourceMappingURL=schema-registry.d.ts.map