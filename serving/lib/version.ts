import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Returns the npm version.
 */
export function getVersion(importMetaDirname: string): string {
  // Check dist bundle relative path first: dist/skills-cli/package.json
  const bundlePkgPath = join(importMetaDirname, "../../package.json");
  if (existsSync(bundlePkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(bundlePkgPath, "utf8"));
      if (pkg.version) return pkg.version;
    } catch {}
  }

  // Walk upward from importMetaDirname to find the nearest package.json with a "version" field
  let dir = importMetaDirname;
  while (dir !== dirname(dir)) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, "utf8"));
        if (pkg.version) return pkg.version;
      } catch {}
    }
    dir = dirname(dir);
  }

  throw new Error(`Could not find package.json with a valid version from ${importMetaDirname}`);
}

