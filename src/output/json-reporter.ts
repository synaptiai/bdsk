import type { ConformanceReport } from "../types/report.js";

export function formatJson(report: ConformanceReport): string {
  return JSON.stringify(report, null, 2);
}
