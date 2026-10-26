import { marked, type Token, type Tokens } from "marked";
import { isGithubAlertType, type GithubAlertType } from "../core/guide-validation.ts";

function isOrderedList(token: Token): token is Tokens.List {
  return token.type === "list" && Boolean((token as Tokens.List).ordered);
}

function isBlockquote(token: Token): token is Tokens.Blockquote {
  return token.type === "blockquote";
}

function indentBlock(text: string): string {
  return text.replace(/^(?=[^\n]*\S)/gm, "    ");
}

const ALERT_LABELS: Record<GithubAlertType, { label: string; className: string }> = {
  NOTE: { label: "Note", className: "note" },
  TIP: { label: "Tip", className: "tip" },
  IMPORTANT: { label: "Important", className: "special" },
  WARNING: { label: "Warning", className: "warning" },
  CAUTION: { label: "Caution", className: "caution" },
};

function convertAlert(token: Tokens.Blockquote): string {
  const match = token.raw.match(/^> ?\[!(\w+)\][ \t]*\n/);
  if (!match) return token.raw;

  const type = match[1].toUpperCase();
  if (!isGithubAlertType(type)) {
    throw new Error(`Unsupported GitHub alert type "[!${match[1]}]".`);
  }
  const alert = ALERT_LABELS[type];

  const trailing = token.raw.match(/\n*$/)?.[0] ?? "";
  const body = token.raw
    .slice(match[0].length, token.raw.length - trailing.length)
    .replace(/^> ?/gm, "")
    .trim();

  const bodyTokens: Token[] = marked.lexer(body).filter(t => t.type !== "space");
  const isSingleParagraph = bodyTokens.length === 1 && bodyTokens[0].type === "paragraph";
  if (isSingleParagraph) {
    return `${alert.label}: ${body}${trailing}`;
  }
  return `<aside class="${alert.className}"><b>${alert.label}:</b>\n\n${body}\n\n</aside>${trailing}`;
}

import {
  moonriseHeadingId,
  githubSlug,
  EXPLICIT_HEADING_ID_PATTERN,
  type HeadingMapResult,
  buildHeadingMap,
} from "../core/headings.ts";

export {
  moonriseHeadingId,
  githubSlug,
  EXPLICIT_HEADING_ID_PATTERN,
  type HeadingMapResult,
  buildHeadingMap,
};

const RE_RAW_JINJA = /(\{\{\s*macros\.[^}]+\}\}|\{%\s*(?:import|include)\s+[^%]+%\}|\{%\s*(?:verbatim|endverbatim)\s*%\})|(\{\{[^\n]*?\}\}|\{\{|\{%|\{#)/g;

/**
 * Escapes non-macro Jinja delimiters with {% verbatim %} tags.
 */
export function escapeJinjaDelimiters(text: string): string {
  return text.replace(RE_RAW_JINJA, (match, safeMacro, rawDelimiter) => {
    if (safeMacro) return safeMacro;
    return `{% verbatim %}${rawDelimiter}{% endverbatim %}`;
  });
}

function normalizeCodeFenceIndentation(text: string): string {
  const lines = text.split("\n");
  let openIndent: string | null = null;
  let openFenceChar: string | null = null;
  const result: string[] = [];

  for (const line of lines) {
    const fenceMatch = line.match(/^([ \t]*)(`{3,}|~{3,})(.*)$/);
    if (!fenceMatch) {
      result.push(line);
      continue;
    }

    if (openIndent === null) {
      openIndent = fenceMatch[1];
      openFenceChar = fenceMatch[2][0];
      result.push(line);
    } else if (fenceMatch[2][0] === openFenceChar && fenceMatch[3].trim() === "") {
      result.push(`${openIndent}${fenceMatch[2]}`);
      openIndent = null;
      openFenceChar = null;
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

function normalizeListItemFences(listRaw: string): string {
  const lines = listRaw.split("\n");
  const result: string[] = [];
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFence = /^[ \t]*(`{3,}|~{3,})/.test(line);

    if (isFence && !inCode) {
      if (i > 0 && lines[i - 1].trim().length > 0) {
        result.push("");
      }
      inCode = true;
      result.push(line);
      continue;
    }

    if (isFence && inCode) {
      inCode = false;
      result.push(line);
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

const RE_BASELINE_MACRO = /(\{\{\s*macros\.BaselineStatus\('[^']+'\)\s*\}\})\.?([ \t\r\n]+(?=\S))?/g;

export interface DevsiteMarkdownOptions {
  filePath?: string;
  onListMerge?: (stepNumber: number) => void;
  currentGuideId?: string;
}

export interface DevsiteMarkdownResult {
  markdown: string;
  hasBaselineMacro: boolean;
  headingIds: Set<string>;
}

/**
 * Transforms guide markdown into full DevSite markdown in a single AST pass:
 *  - Maps GitHub alerts to DevSite notices (notices/asides).
 *  - Folds unindented blocks back into interrupted ordered lists.
 *  - Normalizes explicit heading IDs to Moonrise `{: #id }` syntax.
 *  - Resolves internal `#anchor` links against the page's Moonrise heading ID map.
 *  - Formats BaselineStatus macro lines and tracks baseline macro usage.
 *  - Ensures blank lines precede lists and code blocks.
 *  - Normalizes closing code fence indentation.
 *  - Escapes stray Jinja delimiters with `{% verbatim %}`.
 */
export function toDevsiteMarkdown(
  markdown: string,
  options?: DevsiteMarkdownOptions | ((stepNumber: number) => void)
): DevsiteMarkdownResult {
  const opts: DevsiteMarkdownOptions =
    typeof options === "function" ? { onListMerge: options } : (options ?? {});

  const normalized = markdown.replace(/\r\n?/g, "\n");
  const { headingMap, headingIds } = buildHeadingMap(normalized);

  const tokens = marked.lexer(normalized);
  const reconstructed = tokens.map(t => t.raw).join("");
  if (reconstructed !== normalized) {
    throw new Error("marked lexer tokens don't round-trip the source markdown; refusing to rewrite it.");
  }

  const out: string[] = [];
  let pending: { nextNumber: number; outIndex: number } | undefined;
  let hasBaselineMacro = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    ensureBlankLineBeforeBlock(out, tokens[i - 1], token);

    if (isOrderedList(token)) {
      const start = typeof token.start === "number" ? token.start : 1;
      if (pending && start === pending.nextNumber && start > 1) {
        const interrupting = out.splice(pending.outIndex);
        out.push(indentBlock(interrupting.join("")));
        opts.onListMerge?.(start);
      }

      const listContent = normalizeListItemFences(token.raw);
      out.push(listContent);
      pending = { nextNumber: start + token.items.length, outIndex: out.length };
      continue;
    }

    if (token.type === "list") {
      pending = undefined;
      const listContent = normalizeListItemFences(token.raw);
      out.push(listContent);
      continue;
    }

    if (token.type === "code") {
      const normalizedCode = normalizeCodeFenceIndentation(token.raw);
      out.push(normalizedCode);
      continue;
    }

    if (token.type === "heading" || token.type === "hr") {
      pending = undefined;
    }

    if (token.type === "heading") {
      if (token.depth >= 2) {
        const explicitMatch = token.text.match(EXPLICIT_HEADING_ID_PATTERN);
        if (explicitMatch) {
          const explicitId = explicitMatch[1];
          const headingPrefix = token.raw.slice(0, token.raw.indexOf(token.text));
          const strippedText = token.text.slice(0, explicitMatch.index).trim();
          const trailingNewlines = token.raw.match(/\n*$/)?.[0] ?? "\n";
          out.push(`${headingPrefix}${strippedText} {: #${explicitId} }${trailingNewlines}`);
          continue;
        }
      }
      out.push(token.raw);
      continue;
    }

    if (token.type === "hr") {
      out.push(token.raw);
      continue;
    }

    if (isBlockquote(token)) {
      out.push(convertAlert(token));
      continue;
    }

    out.push(token.raw);
  }

  let assembled = out.join("");

  // Normalize BaselineStatus macro invocations: strip trailing '.' and ensure spacing
  assembled = assembled.replace(RE_BASELINE_MACRO, (_match, macro, after) => {
    hasBaselineMacro = true;
    if (after) {
      return `${macro}\n\n`;
    }
    return `${macro}\n`;
  });
  if (assembled.includes("macros.BaselineStatus")) {
    hasBaselineMacro = true;
  }

  // Rewrite internal anchors [text](#anchor) using headingMap
  assembled = assembled.replace(/\[([^\]]+)\]\(#([^)]+)\)/g, (fullMatch, linkText, fragment) => {
    const resolved = headingMap.get(fragment) ?? headingMap.get(fragment.replace(/-/g, "_"));
    if (!resolved) {
      const location = opts.filePath ? ` in ${opts.filePath}` : "";
      throw new Error(`Unresolved anchor "#${fragment}"${location}. No matching heading found on this page.`);
    }
    return `[${linkText}](#${resolved})`;
  });

  // Escape raw Jinja delimiters outside existing emitted macros/includes
  assembled = escapeJinjaDelimiters(assembled);

  return {
    markdown: assembled,
    hasBaselineMacro,
    headingIds,
  };
}

function ensureBlankLineBeforeBlock(out: string[], prevToken: Token | undefined, currentToken: Token): void {
  if (out.length === 0 || !prevToken) return;
  if (currentToken.type === "space") return;
  if (prevToken.type === "space") return;
  if (prevToken.type === "heading" || prevToken.type === "hr") return;
  if (currentToken.type === "heading" || currentToken.type === "hr") return;

  const lastIndex = out.length - 1;
  const last = out[lastIndex];
  if (!/\n[ \t]*\n$/.test(last)) {
    const trailingNewlines = last.match(/\n*$/)?.[0].length ?? 0;
    const needed = Math.max(0, 2 - trailingNewlines);
    if (needed > 0) {
      out[lastIndex] = last + "\n".repeat(needed);
    }
  }
}
