import { stringify } from "yaml";
import type { ConformanceReport } from "../types/report.js";

export function formatYaml(report: ConformanceReport): string {
  return stringify(report, { lineWidth: 120 });
}
