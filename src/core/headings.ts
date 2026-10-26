import { marked } from "marked";

function toInlineHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]*)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

/**
 * Generates heading IDs matching Hoedown's `rndr_header_id` (used by DevSite / Moonrise)
 * with the underscore separator (`devrel/infra/moonrise/hoedown/c/hoedown.cc`).
 */
export function moonriseHeadingId(text: string): string {
  const html = toInlineHtml(text);
  const buf = Buffer.from(html, "utf8");
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    const c = String.fromCharCode(b);
    if (/[a-zA-Z0-9]/.test(c)) {
      out += c.toLowerCase();
    } else if (c === " " || c === "-" || c === "_") {
      if (out.length > 0 && !out.endsWith("_")) {
        out += "_";
      }
    } else if (b > 127) {
      out += "%" + b.toString(16).toUpperCase();
    } else if (c === "&") {
      while (i < buf.length && buf[i] !== 59 /* ';' */) {
        i++;
      }
    } else if (c === "<") {
      while (i < buf.length && buf[i] !== 62 /* '>' */) {
        i++;
      }
    }
  }
  return out.replace(/_+$/, "");
}

/**
 * Standard GitHub slug generation for heading text.
 */
export function githubSlug(text: string): string {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!&])/g, "$1")
    .toLowerCase()
    .trim()
    .replace(/ /g, "-")
    .replace(/[^\w-]/g, "");
}

export const EXPLICIT_HEADING_ID_PATTERN = /\s*\{:?\s*#([\w-]+)\s*\}\s*$/;

export interface HeadingMapResult {
  headingMap: Map<string, string>;
  headingIds: Set<string>;
}

export function buildHeadingMap(markdown: string): HeadingMapResult {
  const headingMap = new Map<string, string>();
  const headingIds = new Set<string>();
  const seenMoonrise = new Map<string, number>();

  const tokens = marked.lexer(markdown);

  for (const token of tokens) {
    if (token.type !== "heading" || token.depth < 2) continue;
    const rawHeadingText = token.text.trim();
    const explicitMatch = rawHeadingText.match(EXPLICIT_HEADING_ID_PATTERN);

    if (explicitMatch) {
      const explicitId = explicitMatch[1];
      const strippedText = rawHeadingText.slice(0, explicitMatch.index).trim();
      headingIds.add(explicitId);
      headingMap.set(explicitId, explicitId);
      if (strippedText) {
        const gh = githubSlug(strippedText);
        const mr = moonriseHeadingId(strippedText);
        headingMap.set(gh, explicitId);
        headingMap.set(gh.replace(/-+/g, "-"), explicitId);
        headingMap.set(mr, explicitId);
        headingMap.set(gh.replace(/-/g, "_"), explicitId);
      }
      continue;
    }

    const baseMoonriseId = moonriseHeadingId(rawHeadingText);
    const count = seenMoonrise.get(baseMoonriseId) ?? 0;
    seenMoonrise.set(baseMoonriseId, count + 1);
    const moonriseId = count > 0 ? `${baseMoonriseId}_${count + 1}` : baseMoonriseId;
    headingIds.add(moonriseId);

    const baseGithubSlug = githubSlug(rawHeadingText);
    const githubId = count > 0 ? `${baseGithubSlug}-${count}` : baseGithubSlug;

    headingMap.set(moonriseId, moonriseId);
    headingMap.set(githubId, moonriseId);
    headingMap.set(githubId.replace(/-+/g, "-"), moonriseId);
    headingMap.set(baseGithubSlug, moonriseId);
    headingMap.set(baseGithubSlug.replace(/-+/g, "-"), moonriseId);
    headingMap.set(githubId.replace(/-/g, "_"), moonriseId);
    headingMap.set(baseGithubSlug.replace(/-/g, "_"), moonriseId);
  }

  return { headingMap, headingIds };
}
