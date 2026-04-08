/**
 * Simple glob pattern matching for file paths.
 * Supports: * (any segment chars), ** (any path segments), ? (single char)
 */
export function minimatch(path, pattern) {
    try {
        // Escape regex-special chars first, preserving glob chars (* ? **)
        const escaped = pattern
            .replace(/[{}()[\]+^$|\\]/g, "\\$&")
            .replace(/\./g, "\\.")
            .replace(/\*\*/g, "{{GLOBSTAR}}")
            .replace(/\*/g, "[^/]*")
            .replace(/\?/g, "[^/]")
            .replace(/\{\{GLOBSTAR\}\}/g, ".*");
        return new RegExp(`^${escaped}$`).test(path);
    }
    catch {
        // Invalid pattern — treat as non-match rather than crash
        return false;
    }
}
//# sourceMappingURL=minimatch.js.map