import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";
const DEFAULT_CONFIG = {
    artifacts_dir: "artifacts/",
    schemas_dir: null,
    file_extensions: [".yaml", ".yml", ".json"],
    authority: {},
    ignore_paths: ["**/*.draft.yaml"],
    strict_mode: false,
};
export function loadConfig(repoRoot, configPath) {
    const cfgPath = configPath
        ? resolve(configPath)
        : join(resolve(repoRoot), ".bdsk", "config.yaml");
    if (!existsSync(cfgPath)) {
        return { ...DEFAULT_CONFIG };
    }
    const raw = readFileSync(cfgPath, "utf-8");
    const parsed = parseYaml(raw);
    return {
        artifacts_dir: parsed.artifacts_dir ?? DEFAULT_CONFIG.artifacts_dir,
        schemas_dir: parsed.schemas_dir ?? DEFAULT_CONFIG.schemas_dir,
        file_extensions: parsed.file_extensions ?? DEFAULT_CONFIG.file_extensions,
        authority: parsed.authority ?? DEFAULT_CONFIG.authority,
        ignore_paths: parsed.ignore_paths ?? DEFAULT_CONFIG.ignore_paths,
        strict_mode: parsed.strict_mode ?? DEFAULT_CONFIG.strict_mode,
    };
}
//# sourceMappingURL=config.js.map