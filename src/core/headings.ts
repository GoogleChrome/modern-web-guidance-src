import { marked, type Token, type Tokens } from "marked";

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

const SETEXT_UNDERLINE_SUFFIX = /(\r?\n[ \t]*[=-]+[ \t]*\r?\n*)$/;
const TRAILING_NEWLINES_SUFFIX = /(\r?\n*)$/;

/**
 * Strip a trailing `{#id}` or `{: #id }` suffix from a heading token's raw
 * markdown without altering its trailing newlines or Setext underline.
 */
export function stripExplicitHeadingId(raw: string): string {
  const underlineMatch = raw.match(SETEXT_UNDERLINE_SUFFIX);
  const suffix = underlineMatch
    ? underlineMatch[1]
    : (raw.match(TRAILING_NEWLINES_SUFFIX)?.[1] ?? "");
  const body = raw.slice(0, raw.length - suffix.length);
  return body.replace(EXPLICIT_HEADING_ID_PATTERN, "") + suffix;
}

/**
 * Strip `{#id}` / `{: #id }` suffixes from markdown headings outside code
 * blocks so agent-facing output renders clean headings.
 */
export function stripHeadingIdsFromMarkdown(markdown: string): string {
  const tokens = marked.lexer(markdown);
  return tokens
    .map((token) =>
      token.type === "heading" ? stripExplicitHeadingId(token.raw) : token.raw,
    )
    .join("");
}

export interface HeadingMapResult {
  headingMap: Map<string, string>;
  headingIds: Set<string>;
}

export interface HeadingIndexResult extends HeadingMapResult {
  headingTokens: Map<string, Tokens.Heading>;
}

/**
 * Index headings (level >= 2) from pre-tokenized markdown, resolving both
 * explicit `{#id}` anchors and GitHub/Moonrise slugs to canonical heading IDs
 * and their `Tokens.Heading` nodes.
 */
export function indexHeadingsFromTokens(tokens: readonly Token[]): HeadingIndexResult {
  const headingMap = new Map<string, string>();
  const headingIds = new Set<string>();
  const headingTokens = new Map<string, Tokens.Heading>();
  const seenMoonrise = new Map<string, number>();

  for (const token of tokens) {
    if (token.type !== "heading" || token.depth < 2) continue;
    const headingToken = token as Tokens.Heading;
    const rawHeadingText = headingToken.text.trim();
    const explicitMatch = rawHeadingText.match(EXPLICIT_HEADING_ID_PATTERN);

    if (explicitMatch) {
      const explicitId = explicitMatch[1];
      const strippedText = rawHeadingText.slice(0, explicitMatch.index).trim();
      headingIds.add(explicitId);
      headingMap.set(explicitId, explicitId);
      if (!headingTokens.has(explicitId)) {
        headingTokens.set(explicitId, headingToken);
      }
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
    headingTokens.set(moonriseId, headingToken);

    const baseGithubSlug = githubSlug(rawHeadingText);
    const githubId = count > 0 ? `${baseGithubSlug}-${count}` : baseGithubSlug;

    headingMap.set(moonriseId, moonriseId);
    headingMap.set(githubId, moonriseId);
    headingMap.set(githubId.replace(/-+/g, "-"), moonriseId);
    headingMap.set(githubId.replace(/-/g, "_"), moonriseId);
  }

  return { headingMap, headingIds, headingTokens };
}

export function buildHeadingMap(markdown: string): HeadingMapResult {
  const { headingMap, headingIds } = indexHeadingsFromTokens(marked.lexer(markdown));
  return { headingMap, headingIds };
}

export interface ExtractSectionOptions {
  /** Keep the matched heading at the top of the slice (default: false for INCLUDE). */
  includeHeading?: boolean;
  /** Strip `{#id}` / `{: #id }` suffixes from headings in the slice (default: false). */
  stripHeadingIds?: boolean;
}

/**
 * Extract a section by matched heading token from pre-tokenized markdown,
 * ending at the next heading of equal or shallower depth.
 */
export function extractSectionFromTokens(
  tokens: readonly Token[],
  heading: Tokens.Heading,
  options: ExtractSectionOptions = {},
): string | undefined {
  const start = tokens.indexOf(heading);
  if (start === -1) {
    return undefined;
  }
  // Section retrieve deliberately omits the parent `##` intro and the guide's
  // top-level intro. That's verified safe for `js` today (all of its `##`
  // sections have zero prose outside `###`, and the top intro is framing only),
  // but other guides may hide caveats there, so revisit if guided runs show
  // agents missing context.
  const end = tokens.findIndex(
    (t, i) => i > start && t.type === "heading" && t.depth <= heading.depth,
  );
  const stop = end === -1 ? tokens.length : end;
  const sliceStart = options.includeHeading ? start : start + 1;
  return tokens
    .slice(sliceStart, stop)
    .map((t) =>
      options.stripHeadingIds && t.type === "heading" ? stripExplicitHeadingId(t.raw) : t.raw,
    )
    .join("")
    .trim();
}
