/**
 * Simple glob pattern matching for file paths.
 * Supports: * (any segment chars), ** (any path segments), ? (single char)
 */
export function minimatch(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(path);
}
