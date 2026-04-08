import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
export class SchemaRegistry {
    ajv;
    validators = new Map();
    constructor() {
        this.ajv = new Ajv({
            allErrors: true,
            strict: false,
            validateSchema: false, // don't validate schemas against meta-schema at load time
        });
        addFormats(this.ajv);
    }
    /**
     * Load all schemas from a directory. Expects common.json + 12 kind-specific schemas.
     * If schemasDir is not provided, uses the bundled schemas from the repo.
     */
    loadFromDirectory(schemasDir) {
        const resolved = resolve(schemasDir);
        // Load common.json first so $ref works
        const commonPath = join(resolved, "common.json");
        const commonSchema = JSON.parse(readFileSync(commonPath, "utf-8"));
        this.ajv.addSchema(commonSchema, commonSchema.$id ?? "common.json");
        // Load all other schemas
        const files = readdirSync(resolved).filter((f) => f.endsWith(".json") && f !== "common.json");
        for (const file of files) {
            const schemaPath = join(resolved, file);
            const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
            const kind = file.replace(".json", "");
            const compiled = this.ajv.compile(schema);
            this.validators.set(kind, compiled);
        }
    }
    /** Validate an artifact's raw content against its kind-specific schema. */
    validate(kind, raw) {
        const validator = this.validators.get(kind);
        if (!validator) {
            return {
                valid: false,
                errors: [{ path: "/kind", message: `No schema found for kind '${kind}'` }],
            };
        }
        const valid = validator(raw);
        if (valid)
            return { valid: true, errors: [] };
        return {
            valid: false,
            errors: (validator.errors ?? []).map((e) => ({
                path: e.instancePath || "/",
                message: e.message ?? "Unknown validation error",
            })),
        };
    }
    /** Get the default bundled schemas directory (relative to repo root). */
    static bundledSchemasDir() {
        // Works in both Bun (import.meta.dir) and Node.js ESM (import.meta.url)
        const currentDir = typeof import.meta.dir === "string"
            ? import.meta.dir
            : dirname(fileURLToPath(import.meta.url));
        return join(currentDir, "..", "..", "..", "schemas");
    }
}
//# sourceMappingURL=schema-registry.js.map