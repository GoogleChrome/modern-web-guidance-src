import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Returns the npm version.
 */
export function getVersion(importMetaDirname: string): string {
  try {
    // Resolves to serving/package.json in dev, or dist/skills-cli/package.json in prod bundles
    const pkgPath = join(importMetaDirname, "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return pkg.version || "unknown";
  } catch (e) {
    return "unknown";
  }
}
