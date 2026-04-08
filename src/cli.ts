#!/usr/bin/env node

import { validate, VALIDATOR_VERSION, type Phase } from "./index.js";
import { formatText } from "./output/text-reporter.js";
import { formatYaml } from "./output/yaml-reporter.js";
import { formatJson } from "./output/json-reporter.js";
import { writeFileSync } from "fs";

function parseArgs(args: string[]): {
  format: "text" | "yaml" | "json";
  output: string | null;
  artifactsDir: string | undefined;
  schemasDir: string | undefined;
  configPath: string | undefined;
  phase: Phase | "all";
  execution: string | undefined;
  strict: boolean;
  quiet: boolean;
  verbose: boolean;
  version: boolean;
  path: string;
} {
  const result = {
    format: "text" as "text" | "yaml" | "json",
    output: null as string | null,
    artifactsDir: undefined as string | undefined,
    schemasDir: undefined as string | undefined,
    configPath: undefined as string | undefined,
    phase: "all" as Phase | "all",
    execution: undefined as string | undefined,
    strict: false,
    quiet: false,
    verbose: false,
    version: false,
    path: ".",
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "--format": case "-f":
        result.format = args[++i] as typeof result.format;
        break;
      case "--output": case "-o":
        result.output = args[++i];
        break;
      case "--artifacts-dir": case "-a":
        result.artifactsDir = args[++i];
        break;
      case "--schemas-dir": case "-s":
        result.schemasDir = args[++i];
        break;
      case "--config": case "-c":
        result.configPath = args[++i];
        break;
      case "--phase": case "-p":
        result.phase = args[++i] as typeof result.phase;
        break;
      case "--execution": case "-e":
        result.execution = args[++i];
        break;
      case "--strict":
        result.strict = true;
        break;
      case "--quiet": case "-q":
        result.quiet = true;
        break;
      case "--verbose": case "-v":
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

  const phases = args.phase === "all"
    ? undefined
    : [args.phase as Phase];

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

    let formatted: string;
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
    } else if (!args.quiet) {
      console.log(formatted);
    }

    const exitCode = report.repository_outcome === "conformant" ? 0 : 1;
    process.exit(exitCode);
  } catch (e) {
    if (!args.quiet) {
      console.error(`Validator internal error: ${e}`);
    }
    process.exit(2);
  }
}

main();
