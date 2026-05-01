import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { rootDir } from "../../lib/paths.ts";

/**
 * Result of resolving an INCLUDE argument. Mirrors the result-object
 * pattern used by `validateFeature` in baseline.ts.
 */
export interface IncludeResolution {
  isValid: boolean;
  errorMessage?: string;
  /** Resolved content. May be "" for a silent miss (missing file or section). */
  content?: string;
  /** Absolute path of the resolved file, used as the caller path for nested expansion. */
  absolutePath?: string;
}

// NOTE: simple slugify, not a full GitHub-compatible algorithm. Adequate for
// the predictable ASCII section names we use in features/*.md. Upgrade to a
// package if we hit Unicode or duplicate-heading edge cases.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Resolve and load an INCLUDE argument. Returns `{ isValid: false, errorMessage }`
 * for programmer errors (currently: absolute paths). Returns
 * `{ isValid: true, content, absolutePath }` otherwise; `content` is "" for a
 * silent miss when the file or section does not exist.
 *
 * Path resolution: `./` / `../` paths resolve relative to `callerPath`'s
 * directory; bare paths resolve relative to repo root.
 */
export function resolveInclude(rawArg: string, callerPath: string): IncludeResolution {
  if (rawArg.startsWith("/")) {
    return { isValid: false, errorMessage: `Absolute paths are not allowed (got "${rawArg}")` };
  }

  const hashIdx = rawArg.indexOf("#");
  const rawPath = hashIdx === -1 ? rawArg : rawArg.slice(0, hashIdx);
  const sectionId = hashIdx === -1 ? "" : rawArg.slice(hashIdx + 1);

  const absolutePath = rawPath.startsWith("./") || rawPath.startsWith("../")
    ? path.resolve(path.dirname(callerPath), rawPath)
    : path.resolve(rootDir, rawPath);

  loadBody(absolutePath); // populate cache (or mark missing as "")
  const content = sectionId
    ? loadSection(absolutePath, sectionId)
    : fileCache.get(absolutePath)![""];

  return { isValid: true, content, absolutePath };
}

// File cache: absolutePath -> { "" -> post-frontmatter, post-h1 body, ...sectionId -> section body }
const fileCache = new Map<string, Record<string, string>>();

/**
 * Read a markdown file's body (frontmatter + leading H1 stripped, trimmed).
 * Returns "" if the file doesn't exist. Cached per absolute path.
 */
function loadBody(absolutePath: string): string {
  let record = fileCache.get(absolutePath);
  if (!record) {
    record = {};
    fileCache.set(absolutePath, record);
    if (!fs.existsSync(absolutePath)) {
      record[""] = "";
    } else {
      const raw = fs.readFileSync(absolutePath, "utf-8");
      let body = matter(raw).content.trim();
      // Strip a leading "# Title" line — redundant when transcluded.
      const firstNL = body.indexOf("\n");
      const firstLine = firstNL === -1 ? body : body.slice(0, firstNL);
      if (/^#\s+/.test(firstLine)) {
        body = firstNL === -1 ? "" : body.slice(firstNL + 1).trim();
      }
      record[""] = body;
    }
  }
  return record[""];
}

/**
 * Extract a section by id, dropping the heading itself. A heading matches
 * when its `{#id}` suffix equals `sectionId` or its text slugifies to it.
 * Section ends at the next heading of equal or shallower depth.
 * Cached per (file, sectionId).
 *
 * Heading detection is regex-based and skips H1 to avoid clashing with
 * document titles. Known limitation: a `### foo` line inside a fenced code
 * block is treated as a real heading.
 */
function loadSection(absolutePath: string, sectionId: string): string {
  const record = fileCache.get(absolutePath)!;
  if (sectionId in record) return record[sectionId];

  const body = record[""];
  let result = "";
  if (body) {
    const headings = [...body.matchAll(/^(#{2,})\s+(.+?)(?:\s*\{\s*#([\w-]+)\s*\})?\s*$/gm)];
    for (let i = 0; i < headings.length; i++) {
      const [match, hashes, text, explicitId] = headings[i];
      if (explicitId !== sectionId && slugify(text) !== sectionId) continue;

      const start = headings[i].index! + match.length;
      let end = body.length;
      for (let j = i + 1; j < headings.length; j++) {
        if (headings[j][1].length <= hashes.length) {
          end = headings[j].index!;
          break;
        }
      }
      result = body.slice(start, end).trim();
      break;
    }
  }
  record[sectionId] = result;
  return result;
}
