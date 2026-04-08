import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";

export interface ValidatorConfig {
  artifacts_dir: string;
  schemas_dir: string | null;
  file_extensions: string[];
  authority: Record<string, string[]>;
  ignore_paths: string[];
  strict_mode: boolean;
}

const DEFAULT_CONFIG: ValidatorConfig = {
  artifacts_dir: "artifacts/",
  schemas_dir: null,
  file_extensions: [".yaml", ".yml", ".json"],
  authority: {},
  ignore_paths: ["**/*.draft.yaml"],
  strict_mode: false,
};

export function loadConfig(repoRoot: string, configPath?: string): ValidatorConfig {
  const cfgPath = configPath
    ? resolve(configPath)
    : join(resolve(repoRoot), ".bdsk", "config.yaml");

  if (!existsSync(cfgPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(cfgPath, "utf-8");
  const parsed = parseYaml(raw) as Record<string, unknown>;

  return {
    artifacts_dir: (parsed.artifacts_dir as string) ?? DEFAULT_CONFIG.artifacts_dir,
    schemas_dir: (parsed.schemas_dir as string | null) ?? DEFAULT_CONFIG.schemas_dir,
    file_extensions: (parsed.file_extensions as string[]) ?? DEFAULT_CONFIG.file_extensions,
    authority: (parsed.authority as Record<string, string[]>) ?? DEFAULT_CONFIG.authority,
    ignore_paths: (parsed.ignore_paths as string[]) ?? DEFAULT_CONFIG.ignore_paths,
    strict_mode: (parsed.strict_mode as boolean) ?? DEFAULT_CONFIG.strict_mode,
  };
}
