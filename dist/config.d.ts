export interface ValidatorConfig {
    artifacts_dir: string;
    schemas_dir: string | null;
    file_extensions: string[];
    authority: Record<string, string[]>;
    ignore_paths: string[];
    strict_mode: boolean;
}
export declare function loadConfig(repoRoot: string, configPath?: string): ValidatorConfig;
//# sourceMappingURL=config.d.ts.map