import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BUNDLE_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves the skills-cli data root directory (containing gen/ and guides/).
 * - Shipped bundle: dist/skills-cli/skills/modern-web-guidance
 * - Repo development: out/build/skills-cli
 */
export function resolveSkillsCliDataDir(): string {
  // In the shipped bundle (dist/skills-cli/skills/modern-web-guidance/), gen/guides.json and gen/guide-chunks.* sit next to modern-web.mjs / search.mjs
  if (fs.existsSync(path.join(BUNDLE_DIR, 'gen/guides.json')) || fs.existsSync(path.join(BUNDLE_DIR, 'gen/guide-chunks.json.gz'))) {
    return BUNDLE_DIR;
  }
  // In repo source mode (src/rag/), walk up to repo root (where pnpm-lock.yaml lives) and use out/build/skills-cli
  let dir = BUNDLE_DIR;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) {
      return path.join(dir, 'out/build/skills-cli');
    }
    dir = path.dirname(dir);
  }
  return BUNDLE_DIR;
}
