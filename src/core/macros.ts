import { validateFeature, getStatusMessage, getFeatureName, pendingFeatures } from "./baseline.ts";
import { getGuidesMap } from "./guide-validation.ts";
import { resolveInclude } from "./include.ts";
import { MACRO_PATTERN, CONSECUTIVE_MACRO_PATTERN, COMMENT_PATTERN, parseArguments, getTranscludedFeatureIds, stripComments, maskComments } from "./macro-parsing.ts";

// Re-exported for convenience; the implementations live in the dependency-free ./macro-parsing.ts
export { MACRO_PATTERN, CONSECUTIVE_MACRO_PATTERN, COMMENT_PATTERN, parseArguments, getTranscludedFeatureIds, stripComments, maskComments };

export type BuildTarget = 'skills-cli' | 'static-site';

type MacroHandler = (args: string[], filePath: string, options?: { target?: BuildTarget }) => string;

export class MacroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MacroError";
  }
}

export function formatTitle(id: string): string {
  return id
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const MACRO_HANDLERS: Record<string, MacroHandler> = {
  INCLUDE: (args, filePath, options) => {
    const [rawArg] = args;
    if (!rawArg) {
      throw new MacroError(`Missing path in INCLUDE macro (${filePath}).`);
    }

    const result = resolveInclude(rawArg, filePath);
    if (!result.isValid) {
      throw new MacroError(`${result.errorMessage} (referenced in INCLUDE macro in ${filePath}).`);
    }
    if (result.content === undefined) {
      throw new MacroError(`Transcluded file or section not found: "${rawArg}" in ${filePath}.`);
    }

    // NOTE: no cycle detection. If files INCLUDE each other in a loop, this
    // will overflow the call stack. Add a visited set if it becomes a problem.
    return replaceMacros(result.content, result.absolutePath!, options);
  },
  GUIDE_REF: (args, filePath, options) => {
    const [guideId] = args;
    if (!guideId) {
      throw new MacroError(`Missing guide ID in GUIDE_REF macro (${filePath}).`);
    }

    const guideInfo = getGuidesMap().get(guideId);
    if (!guideInfo) {
      throw new MacroError(`Guide "${guideId}" not found (referenced in GUIDE_REF macro in ${filePath}).`);
    }

    if (options?.target === 'static-site') {
      const title = guideInfo.title || formatTitle(guideInfo.name);
      return `[${title}](../${guideInfo.category}/${guideInfo.name}.md)`;
    }

    return `\`${guideId}\` (via \`npx -y modern-web-guidance@latest retrieve "${guideId}"\`)`;
  }
};

defineFeatureMacro("BASELINE_STATUS", {
  content: (args, filePath, options) => {
    const [featureId, bcdKey] = args;
    if (options?.target === 'static-site') {
      return bcdKey ? `{{ BASELINE_STATUS("${featureId}", "${bcdKey}") }}` : `{{ BASELINE_STATUS("${featureId}") }}`;
    }
    const status = getStatusMessage(featureId, bcdKey);
    if (!status) {
      if (bcdKey) {
        throw new MacroError(`BCD key "${bcdKey}" not found (referenced in ${filePath}).`);
      }
      throw new MacroError(`Status not found for feature "${featureId}" (referenced in ${filePath}).`);
    }

    return status;
  }
});


defineFeatureMacro("FEATURE", {
  content: (args, filePath, options) => {
    const [featureId, section] = args;
    let url = `features/${featureId}.md`;
    if (section) {
      url += `#${section}`;
    }
    return MACRO_HANDLERS.INCLUDE([url], filePath, options);
  }
});

function formatFeatureHeadingName(name: string): string {
  // Wrap raw HTML tag names like `<select>` in backticks so they don't render as live HTML elements.
  return name.replace(/<([a-zA-Z0-9:-]+)>/g, '`<$1>`');
}

defineFeatureMacro("FEATURE_FALLBACKS", {
  content: (args, filePath, options) => {
    const [featureId] = args;
    let fallbacks = "";
    try {
      fallbacks = MACRO_HANDLERS.FEATURE([featureId, "fallbacks"], filePath, options);
    } catch (e) {
      if (e instanceof MacroError) {
        fallbacks = "";
      } else {
        throw e;
      }
    }
    // Pending `tmp-*` features have no upstream status yet (#2004), so only their fallbacks are emitted.
    const baselineStatus = featureId in pendingFeatures ? "" : MACRO_HANDLERS.BASELINE_STATUS([featureId], filePath, options);
    if (!fallbacks) {
      return baselineStatus;
    }

    return [
      `### Fallbacks & browser support for ${formatFeatureHeadingName(getFeatureName(featureId))}`,
      baselineStatus,
      fallbacks
    ].filter(Boolean).join("\n\n");
  }
});

defineFeatureMacro("FEATURE_ISSUES", {
  content: (args, filePath, options) => {
    const [featureId] = args;
    let included = "";
    try {
      included = MACRO_HANDLERS.FEATURE([featureId, "issues"], filePath, options);
    } catch (e) {
      if (e instanceof MacroError) {
        included = "";
      } else {
        throw e;
      }
    }
    if (!included) return "";
    return [
      `### Issues to be aware of when using ${formatFeatureHeadingName(getFeatureName(featureId))}`,
      included
    ].join("\n\n");
  }
});

function defineFeatureMacro(name: string, {
  recursive,
  content,
}: {
  recursive?: boolean;
  // Producer: may return anything; we coerce to string below.
  content: (args: string[], filePath: string, options?: { target?: BuildTarget }) => any;
}): MacroHandler {
  const fn: MacroHandler = (args, filePath, options) => {
    const [featureId] = args;
    if (!featureId) {
      throw new MacroError(`Missing feature ID in ${name} macro (${filePath}).`);
    }
    const validation = validateFeature(featureId);
    if (!validation.isValid) {
      throw new MacroError(`${validation.errorMessage} (referenced in ${name} macro in ${filePath}).`);
    }

    let result = content(args, filePath, options);
    if (!result && result !== 0) return "";
    if (typeof result !== "string") result = String(result);
    if (recursive) result = replaceMacros(result, filePath, options);
    return result.trim();
  };
  return (MACRO_HANDLERS[name] = fn);
}

/**
 * Internal helper to iterate over macros and call a processor.
 */
function processMacros(
  content: string,
  onMatch: (handler: MacroHandler, args: string[], match: string) => string | void
): string {
  return content.replace(MACRO_PATTERN, (match: string, name: string, argsString: string): string => {
    const handler = MACRO_HANDLERS[name];
    if (!handler) return match;

    const args = parseArguments(argsString);
    const result = onMatch(handler, args, match);
    return typeof result === 'string' ? result : match;
  });
}

/**
 * Validates all macros in markdown content.
 * @param content - The markdown content to validate
 * @param filePath - The path to the file (for error reporting)
 * @returns Array of validation errors
 */
export function validateMacros(content: string, filePath: string): string[] {
  const errors: string[] = [];
  processMacros(content, (handler, args, match) => {
    try {
      handler(args, filePath);
    } catch (err: any) {
      if (err instanceof MacroError) {
        errors.push(err.message);
      } else {
        errors.push(`Macro error in ${match}: ${err.message} (${filePath})`);
      }
    }
  });
  return errors;
}

export function replaceMacros(content: string, filePath: string, options: { target?: BuildTarget } = {}): string {
  const stripped = stripComments(content);
  const normalized = stripped.replace(CONSECUTIVE_MACRO_PATTERN, "$1\n\n");
  return processMacros(normalized, (handler, args, match) => {
    try {
      return handler(args, filePath, options);
    } catch (err: any) {
      if (err instanceof MacroError) {
        throw err;
      }
      console.error(`Unexpected error processing macro ${match} in ${filePath}:`, err.message);
    }
  });
}
