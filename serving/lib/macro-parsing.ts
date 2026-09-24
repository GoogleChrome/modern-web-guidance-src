/**
 * Dependency-free helpers for parsing transclusion macros.
 *
 * This module intentionally imports nothing else so it can be shared by the
 * ATL triage bot (guides/atl-triage.ts), which runs in a lightweight GitHub
 * Actions job and must avoid pulling in heavy parsing dependencies like
 * 'gray-matter', 'marked', or 'web-features' that the full macro renderer
 * (serving/lib/macros.ts) depends on.
 */

// Matches {{ NAME(ARGS) }} where NAME is uppercase and ARGS can be anything
export const MACRO_PATTERN = /{{\s*([A-Z_]+)\((.*?)\)\s*}}/g;

// Matches consecutive macros separated by whitespace that contains at least one newline
export const CONSECUTIVE_MACRO_PATTERN = /({{\s*[A-Z_]+\(.*?\)\s*}})[ \t]*\r?\n\s*(?={{\s*[A-Z_]+\(.*?\)\s*}})/g;

// Matches comment macros: {# ... #}, disambiguated from heading anchors like {#id}
export const COMMENT_PATTERN = /\{#(?![\w-]+\s*\})[\s\S]*?#\}/g;

const COMMENT_SOURCE = COMMENT_PATTERN.source;
const PARAGRAPH_COMMENT_PATTERN = new RegExp(`(?:\\r?\\n){2,}[ \\t]*${COMMENT_SOURCE}[ \\t]*(?=\\r?\\n\\r?\\n)`, 'g');
const LINE_COMMENT_PATTERN = new RegExp(`(?:^[ \\t]*${COMMENT_SOURCE}[ \\t]*(?:\\r?\\n|$))|(?:\\r?\\n[ \\t]*${COMMENT_SOURCE}[ \\t]*(?=\\r?\\n|$))`, 'g');
const INLINE_COMMENT_PATTERN = new RegExp(`([ \\t]*)${COMMENT_SOURCE}(?:[ \\t]*${COMMENT_SOURCE})*([ \\t]*)`, 'g');
const CODE_BLOCK_PATTERN = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
const INLINE_CODE_PATTERN = /(`+)([\s\S]*?)\1/g;
const RESTORE_CODE_PATTERN = /\x00CODE_(\d+)\x00/g;

/**
 * Runs `transform` on content with fenced code blocks (``` or ~~~) and inline code spans
 * temporarily replaced by placeholders, so comment-like syntax inside code is left untouched.
 */
function withCodeSpansProtected(content: string, transform: (masked: string) => string): string {
  const codeSpans: string[] = [];
  const maskCode = (match: string): string => {
    codeSpans.push(match);
    return `\x00CODE_${codeSpans.length - 1}\x00`;
  };

  let masked = content.replace(CODE_BLOCK_PATTERN, maskCode);
  masked = masked.replace(INLINE_CODE_PATTERN, maskCode);

  let result = transform(masked);

  // Restore protected code spans (bounded to avoid infinite loops on invalid input)
  let iterations = 0;
  const maxIterations = codeSpans.length + 1;
  while (RESTORE_CODE_PATTERN.test(result) && iterations++ < maxIterations) {
    result = result.replace(RESTORE_CODE_PATTERN, (_, idx) => codeSpans[Number(idx)]);
  }
  return result;
}

/**
 * Masks {# ... #} comments for validation while preserving line numbers:
 * - Comments inside fenced code blocks or inline code spans are preserved.
 * - Each line of a comment collapses to a single space, so newlines are kept and words on
 *   either side stay separated, but a comment can't indent the text after it into a code block.
 */
export function maskComments(content: string): string {
  if (!content) return "";

  return withCodeSpansProtected(content, (masked) =>
    masked.replace(COMMENT_PATTERN, (match) => match.replace(/[^\r\n]+/g, " "))
  );
}

/**
 * Strips {# ... #} comments from content and cleanly handles surrounding whitespace:
 * - Comments inside fenced code blocks or inline code spans are preserved.
 * - Heading anchors like `{#stable-id}` are ignored and never treated as comment openers.
 * - Standalone comments on their own lines are completely removed along with trailing newlines.
 * - Inline comments surrounded by spaces on both sides collapse to a single space.
 * - Comments at line/string boundaries or adjacent to punctuation have extra spacing trimmed.
 */
export function stripComments(content: string): string {
  if (!content) return "";

  return withCodeSpansProtected(content, (masked) => {
    // 1. Strip standalone comment paragraphs (surrounded by blank lines)
    let result = masked.replace(PARAGRAPH_COMMENT_PATTERN, "");

    // 2. Strip standalone comment lines (at beginning of text, between single newlines, or at end of text)
    result = result.replace(LINE_COMMENT_PATTERN, "");

    // 3. Strip inline comments and normalize adjacent whitespace
    return result.replace(INLINE_COMMENT_PATTERN, (_match, leading, trailing, offset, fullStr) => {
      const prevChar = offset > 0 ? fullStr[offset - 1] : "";
      const nextChar = offset + _match.length < fullStr.length ? fullStr[offset + _match.length] : "";

      const atStartOfLine = !prevChar || prevChar === "\n" || prevChar === "\r";
      const atEndOfLine = !nextChar || nextChar === "\n" || nextChar === "\r";
      if (atStartOfLine || atEndOfLine) {
        return "";
      }

      if (leading.length > 0 && trailing.length > 0) {
        return " ";
      }

      if (leading.length > 0 || trailing.length > 0) {
        // If opening or closing brackets/parens, or followed by punctuation like , ; : . ! ?
        if (/[\(\[\{]/.test(prevChar) || /[\)\]\},;:!?.]/.test(nextChar)) {
          return "";
        }
        return " ";
      }

      return "";
    });
  });
}

/**
 * Parses macro arguments, respecting quotes and handling commas.
 * Robust against varied whitespace and different quote types.
 */
export function parseArguments(argsString: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes: string | null = null;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if ((char === "'" || char === '"') && (i === 0 || argsString[i - 1] !== "\\")) {
      if (inQuotes === char) {
        inQuotes = null;
      } else if (!inQuotes) {
        inQuotes = char;
      } else {
        current += char;
      }
    } else if (char === "," && !inQuotes) {
      args.push(current.trim().replace(/^['"]|['"]$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim().replace(/^['"]|['"]$/g, ""));
  }

  return args;
}

/**
 * Extracts all feature IDs referenced in transclusion macros (FEATURE, FEATURE_FALLBACKS, FEATURE_ISSUES, and INCLUDE).
 */
export function getTranscludedFeatureIds(content: string): string[] {
  if (!content) return [];
  const featureIds = new Set<string>();
  const stripped = stripComments(content);

  for (const match of stripped.matchAll(MACRO_PATTERN)) {
    const macroName = match[1];
    const rawArgs = match[2];
    const args = parseArguments(rawArgs);
    const firstArg = args[0];
    if (!firstArg) continue;

    if (macroName === "FEATURE" || macroName === "FEATURE_FALLBACKS" || macroName === "FEATURE_ISSUES") {
      featureIds.add(firstArg.trim());
    } else if (macroName === "INCLUDE") {
      // Matches bare features/<id>.md or relative paths like ../../features/<id>.md (with optional #section)
      const featureMatch = firstArg.match(/(?:^|\/)features\/([a-zA-Z0-9_-]+)\.md(?:#|$)/);
      if (featureMatch) {
        featureIds.add(featureMatch[1].trim());
      }
    }
  }

  return Array.from(featureIds);
}
