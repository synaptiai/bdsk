#!/usr/bin/env node
import { validate, VALIDATOR_VERSION } from "./index.js";
import { formatText } from "./output/text-reporter.js";
import { formatYaml } from "./output/yaml-reporter.js";
import { formatJson } from "./output/json-reporter.js";
import { writeFileSync } from "fs";
function parseArgs(args) {
    const result = {
        format: "text",
        output: null,
        artifactsDir: undefined,
        schemasDir: undefined,
        configPath: undefined,
        phase: "all",
        execution: undefined,
        strict: false,
        quiet: false,
        verbose: false,
        version: false,
        path: ".",
    };
    const needsValue = new Set(["--format", "-f", "--output", "-o", "--artifacts-dir", "-a", "--schemas-dir", "-s", "--config", "-c", "--phase", "-p", "--execution", "-e"]);
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (needsValue.has(arg) && i + 1 >= args.length) {
            console.error(`Missing value for ${arg}`);
            process.exit(2);
        }
        switch (arg) {
            case "--format":
            case "-f":
                result.format = args[++i];
                break;
            case "--output":
            case "-o":
                result.output = args[++i];
                break;
            case "--artifacts-dir":
            case "-a":
                result.artifactsDir = args[++i];
                break;
            case "--schemas-dir":
            case "-s":
                result.schemasDir = args[++i];
                break;
            case "--config":
            case "-c":
                result.configPath = args[++i];
                break;
            case "--phase":
            case "-p":
                result.phase = args[++i];
                break;
            case "--execution":
            case "-e":
                result.execution = args[++i];
                break;
            case "--strict":
                result.strict = true;
                break;
            case "--quiet":
            case "-q":
                result.quiet = true;
                break;
            case "--verbose":
            case "-v":
                result.verbose = true;
                break;
            case "--version":
                result.version = true;
                break;
            default:
                if (!arg.startsWith("-")) {
                    result.path = arg;
                }
                break;
        }
        i++;
    }
    return result;
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.version) {
        console.log(`bdsk-validate v${VALIDATOR_VERSION}`);
        process.exit(0);
    }
    if (!["text", "yaml", "json"].includes(args.format)) {
        console.error(`Unknown format '${args.format}'. Valid formats: text, yaml, json`);
        process.exit(2);
    }
    const phases = args.phase === "all"
        ? undefined
        : [args.phase];
    try {
        const report = await validate({
            repositoryPath: args.path,
            artifactsDir: args.artifactsDir,
            schemasDir: args.schemasDir,
            configPath: args.configPath,
            phases,
            executionFilter: args.execution ? [args.execution] : undefined,
            strict: args.strict,
        });
        let formatted;
        switch (args.format) {
            case "yaml":
                formatted = formatYaml(report);
                break;
            case "json":
                formatted = formatJson(report);
                break;
            default:
                formatted = formatText(report, args.verbose);
        }
        if (args.output) {
            writeFileSync(args.output, formatted, "utf-8");
        }
        else if (!args.quiet) {
            console.log(formatted);
        }
        const exitCode = report.repository_outcome === "conformant" ? 0 : 1;
        process.exit(exitCode);
    }
    catch (e) {
        if (!args.quiet) {
            console.error(`Validator internal error: ${e}`);
        }
        process.exit(2);
    }
}
main();
//# sourceMappingURL=cli.js.map