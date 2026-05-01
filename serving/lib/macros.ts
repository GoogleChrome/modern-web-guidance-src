import { validateFeature, getStatusMessage, getFeatureName } from "./baseline.ts";
import { resolveInclude } from "./include.ts";

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

type MacroHandler = (args: string[], filePath: string) => string;

export class MacroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MacroError";
  }
}

// Matches {{ NAME(ARGS) }} where NAME is uppercase and ARGS can be anything
export const MACRO_PATTERN = /{{\s*([A-Z_]+)\((.*?)\)\s*}}/g;

const MACRO_HANDLERS: Record<string, MacroHandler> = {
  INCLUDE: (args, filePath) => {
    const [rawArg] = args;
    if (!rawArg) {
      throw new MacroError(`Missing path in INCLUDE macro (${filePath}).`);
    }

    const result = resolveInclude(rawArg, filePath);
    if (!result.isValid) {
      throw new MacroError(`${result.errorMessage} (referenced in INCLUDE macro in ${filePath}).`);
    }
    if (!result.content) return ""; // silent miss: file or section not found

    // NOTE: no cycle detection. If files INCLUDE each other in a loop, this
    // will overflow the call stack. Add a visited set if it becomes a problem.
    return replaceMacros(result.content, result.absolutePath!);
  },
};

defineFeatureMacro("BASELINE_STATUS", {
  content: (args, filePath) => {
    const [featureId, bcdKey] = args;
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
  content: (args, filePath) => {
    const [featureId, section] = args;
    let url = `features/${featureId}.md`;
    if (section) {
      url += `#${section}`;
    }
    return MACRO_HANDLERS.INCLUDE([url], filePath);
  }
});

defineFeatureMacro("FEATURE_FALLBACKS", {
  content: (args, filePath) => {
    const [featureId] = args;
    const fallbacks = MACRO_HANDLERS.FEATURE([featureId, "fallbacks"], filePath);
    const baselineStatus = MACRO_HANDLERS.BASELINE_STATUS([featureId], filePath);
    if (!fallbacks) {
      return baselineStatus;
    }

    return [
      `### Fallbacks & browser support for ${getFeatureName(featureId)}`,
      baselineStatus,
      fallbacks
    ].join("\n\n");
  }
});

defineFeatureMacro("FEATURE_ISSUES", {
  content: (args, filePath) => {
    const [featureId] = args;
    const included = MACRO_HANDLERS.FEATURE([featureId, "issues"], filePath);
    if (!included) return "";
    return [
      `### Issues to be aware of when using ${getFeatureName(featureId)}`,
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
  content: (args: string[], filePath: string) => any;
}): MacroHandler {
  const fn: MacroHandler = (args, filePath) => {
    const [featureId] = args;
    if (!featureId) {
      throw new MacroError(`Missing feature ID in ${name} macro (${filePath}).`);
    }
    const validation = validateFeature(featureId);
    if (!validation.isValid) {
      throw new MacroError(`${validation.errorMessage} (referenced in ${name} macro in ${filePath}).`);
    }

    let result = content(args, filePath);
    if (!result && result !== 0) return "";
    if (typeof result !== "string") result = String(result);
    if (recursive) result = replaceMacros(result, filePath);
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

export function replaceMacros(content: string, filePath: string): string {
  return processMacros(content, (handler, args, match) => {
    try {
      return handler(args, filePath);
    } catch (err: any) {
      if (err instanceof MacroError) {
        throw err;
      }
      console.error(`Unexpected error processing macro ${match} in ${filePath}:`, err.message);
    }
  });
}
