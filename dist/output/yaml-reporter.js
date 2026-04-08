import { stringify } from "yaml";
export function formatYaml(report) {
    return stringify(report, { lineWidth: 120 });
}
//# sourceMappingURL=yaml-reporter.js.map