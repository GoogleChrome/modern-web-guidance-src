import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolves and returns the package version from the package.json located relative to the caller.
 * In development, this resolves to the local package.json.
 * In production (after bundling), it dynamically resolves relative to the bundled mjs asset.
 */
export function getVersion(importMetaDirname: string): string {
  try {
    const pkgPath = join(importMetaDirname, "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}
