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

  for (const match of content.matchAll(MACRO_PATTERN)) {
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
