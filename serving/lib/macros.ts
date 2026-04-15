import { validateFeature, getStatusMessage } from "./baseline.ts";

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
  BASELINE_STATUS: (args, filePath) => {
    const [featureId, bcdKey] = args;
    if (!featureId) {
      throw new MacroError(`Missing feature ID in BASELINE_STATUS macro (${filePath}).`);
    }

    const result = validateFeature(featureId);
    if (!result.isValid) {
      throw new MacroError(`${result.errorMessage} (referenced in BASELINE_STATUS macro in ${filePath}).`);
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
};

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
