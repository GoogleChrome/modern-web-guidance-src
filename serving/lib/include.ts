import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked, type Token, type Tokens } from "marked";
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

  const [rawPath, ...rest] = rawArg.split("#");
  const sectionId = rest.join("#");
  const absolutePath = rawPath.startsWith("./") || rawPath.startsWith("../")
    ? path.resolve(path.dirname(callerPath), rawPath)
    : path.resolve(rootDir, rawPath);

  const file = loadFile(absolutePath);
  const content = sectionId ? extractSection(file, sectionId) : file.body;
  return { isValid: true, content, absolutePath };
}

interface ParsedFile {
  /** File body with frontmatter and a leading H1 stripped. "" for missing files. */
  body: string;
  /** Lexed body. Joined `.raw` is lossless, so sections slice cleanly. */
  tokens: Token[];
  /** Memoized section bodies by id. "" for misses. */
  sections: Map<string, string>;
}

const fileCache = new Map<string, ParsedFile>();

function loadFile(absolutePath: string): ParsedFile {
  let file = fileCache.get(absolutePath);
  if (file) return file;

  const raw = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf-8") : "";
  // Strip frontmatter and a leading "# Title" line — redundant when transcluded.
  const body = matter(raw).content.trim().replace(/^#\s+[^\n]*\n?/, "").trim();
  file = { body, tokens: marked.lexer(body), sections: new Map() };
  fileCache.set(absolutePath, file);
  return file;
}

const isHeading = (t: Token): t is Tokens.Heading => t.type === "heading";

/**
 * Plain-text projection of a list of marked tokens (block or inline), in the
 * spirit of DOM `Node.textContent`. Strips markdown syntax and HTML tags,
 * keeping only visible content; for links, keeps the visible text and drops
 * the URL. Inline `html` tokens (the tag syntax itself) are skipped, since
 * the visible text between tags lives in adjacent `text` tokens. Block-level
 * HTML is also dropped — its content isn't exposed as child tokens.
 */
function textContent(tokens: Token[] | undefined): string {
  return tokens?.map(t => {
    if ("tokens" in t && t.tokens) return textContent(t.tokens);
    if (t.type === "br") return "\n";
    if (t.type === "html") return "";
    return "text" in t ? t.text : "";
  }).join("") ?? "";
}

// `{#id}` heading-suffix syntax. Not standard CommonMark, and no installed
// marked plugin handles it, so we match it on the heading text ourselves.
const HEADING_ID = /\s*\{\s*#([\w-]+)\s*\}\s*$/;

function matchesHeading(heading: Tokens.Heading, sectionId: string): boolean {
  if (heading.depth < 2) return false; // H1s are document titles, not section anchors.
  let text = textContent(heading.tokens);
  const explicit = HEADING_ID.exec(text);
  if (explicit) {
    if (explicit[1] === sectionId) return true;
    text = text.slice(0, explicit.index);
  }
  return slugify(text) === sectionId;
}

/**
 * Extract a section by id, dropping the heading itself. A heading matches
 * when its `{#id}` suffix equals `sectionId` or its text slugifies to it.
 * Section ends at the next heading of equal or shallower depth.
 */
function extractSection(file: ParsedFile, sectionId: string): string {
  let result = file.sections.get(sectionId);
  if (result !== undefined) return result;

  const { tokens } = file;
  const heading = tokens.find((t): t is Tokens.Heading => isHeading(t) && matchesHeading(t, sectionId));
  if (!heading) {
    result = "";
  } else {
    const start = tokens.indexOf(heading);
    const end = tokens.findIndex((t, i) => i > start && isHeading(t) && t.depth <= heading.depth);
    const stop = end === -1 ? tokens.length : end;
    result = tokens.slice(start + 1, stop).map(t => t.raw).join("").trim();
  }
  file.sections.set(sectionId, result);
  return result;
}
