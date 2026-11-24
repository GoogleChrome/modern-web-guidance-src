import { posix } from 'node:path';

export type FormatEngine = 'dom' | 'js' | 'css' | 'dependency';
export type FormatStatus = 'supported' | 'expected-skip' | 'unsupported';

export interface FormatEntry {
  readonly id: string;
  readonly extensions: readonly string[];
  readonly engines: readonly FormatEngine[];
  readonly status: FormatStatus;
}

/**
 * Format Registry: Single source of truth for all standalone file formats and
 * embedded languages recognized, skipped, or unsupported by legacy-scan.
 *
 * Status semantics (per format-support.md):
 * - 'supported': Every applicable engine runs on it, findings report original line numbers.
 * - 'expected-skip': Deliberately not scanned (e.g. style objects, component styles with no selectors).
 * - 'unsupported': Not scanned today (e.g. templates requiring full compilers, non-web languages).
 */
export const FORMAT_REGISTRY: readonly FormatEntry[] = [
  // Standalone Stylesheets
  {
    id: 'css',
    extensions: ['.css'],
    engines: ['css'],
    status: 'supported',
  },
  {
    // Single-line // comments are stripped before cssomnom selector parsing
    id: 'scss',
    extensions: ['.scss'],
    engines: ['css'],
    status: 'supported',
  },
  {
    // Single-line // comments are stripped before cssomnom selector parsing
    id: 'less',
    extensions: ['.less'],
    engines: ['css'],
    status: 'supported',
  },

  // Markup & Single-File Components (SFCs)
  {
    id: 'html',
    extensions: ['.html', '.htm'],
    engines: ['dom', 'js', 'css'],
    status: 'supported',
  },
  {
    // Includes .blade.php
    id: 'php',
    extensions: ['.php'],
    engines: ['dom', 'js', 'css'],
    status: 'supported',
  },
  {
    id: 'vue',
    extensions: ['.vue'],
    engines: ['dom', 'js', 'css'],
    status: 'supported',
  },
  {
    id: 'svelte',
    extensions: ['.svelte'],
    engines: ['dom', 'js', 'css'],
    status: 'supported',
  },
  {
    id: 'glimmer',
    extensions: ['.gts', '.gjs'],
    engines: ['dom', 'js', 'css'],
    status: 'supported',
  },
  {
    id: 'astro',
    extensions: ['.astro'],
    engines: ['dom', 'js', 'css'],
    status: 'supported',
  },

  // Standalone Scripts & JSX (CSS engine runs via embedded css tagged templates)
  {
    id: 'javascript',
    extensions: ['.js', '.mjs', '.cjs'],
    engines: ['js', 'css'],
    status: 'supported',
  },
  {
    id: 'typescript',
    extensions: ['.ts', '.mts', '.cts'],
    engines: ['js', 'css'],
    status: 'supported',
  },
  {
    // DOM rules run via JSX-DOM bridge; CSS runs via css tagged templates
    id: 'jsx',
    extensions: ['.jsx'],
    engines: ['dom', 'js', 'css'],
    status: 'supported',
  },
  {
    // DOM rules run via JSX-DOM bridge; CSS runs via css tagged templates
    id: 'tsx',
    extensions: ['.tsx'],
    engines: ['dom', 'js', 'css'],
    status: 'supported',
  },

  // Package Manifest
  {
    id: 'package.json',
    extensions: ['package.json'],
    engines: ['dependency'],
    status: 'supported',
  },

  // Expected-Skip Formats (Explicitly Listed)
  {
    // Mostly bare declarations with no selector; CSS rules match selectors
    id: 'styled-components-styled',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    engines: ['css'],
    status: 'expected-skip',
  },
  {
    // JS object literals, not stylesheet rules
    id: 'object-styles',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    engines: ['css'],
    status: 'expected-skip',
  },
  {
    // Measured on real code; found nothing worth extraction cost
    id: 'angular-inline',
    extensions: ['.ts'],
    engines: ['dom', 'css'],
    status: 'expected-skip',
  },
  {
    // Measured on real code; found nothing worth extraction cost
    id: 'lit-html',
    extensions: ['.js', '.ts'],
    engines: ['dom'],
    status: 'expected-skip',
  },

  // Unsupported Formats (From Policy)
  {
    // Under review
    id: 'create-global-style',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    engines: ['css'],
    status: 'unsupported',
  },
  {
    // Not declared syntax
    id: 'untagged-template-css',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    engines: ['css'],
    status: 'unsupported',
  },
  {
    // Requires indentation-based parser/compiler
    id: 'sass',
    extensions: ['.sass'],
    engines: ['css'],
    status: 'unsupported',
  },
  {
    // Requires compiler
    id: 'stylus',
    extensions: ['.styl'],
    engines: ['css'],
    status: 'unsupported',
  },
  {
    // Requires compiler
    id: 'mdx',
    extensions: ['.mdx'],
    engines: ['dom', 'js'],
    status: 'unsupported',
  },
  {
    // Requires compiler
    id: 'pug',
    extensions: ['.pug'],
    engines: ['dom'],
    status: 'unsupported',
  },
  {
    id: 'server-templates',
    extensions: ['.ejs', '.jsp', '.erb', '.cshtml', '.twig'],
    engines: ['dom'],
    status: 'unsupported',
  },
];

// ---------------------------------------------------------------------------
// Derived Sets and Arrays
// ---------------------------------------------------------------------------

const MARKUP_FORMAT_IDS: ReadonlySet<string> = new Set([
  'html',
  'php',
  'vue',
  'svelte',
  'glimmer',
  'astro',
]);

const SCRIPT_FORMAT_IDS: ReadonlySet<string> = new Set([
  'javascript',
  'typescript',
  'jsx',
  'tsx',
]);

const JSX_FORMAT_IDS: ReadonlySet<string> = new Set(['jsx', 'tsx']);

const STYLESHEET_FORMAT_IDS: ReadonlySet<string> = new Set(['css', 'scss', 'less']);

const SUPPORTED_ENTRIES = FORMAT_REGISTRY.filter((f) => f.status === 'supported');

/** All file extensions scanned by legacy-scan (e.g. '.js', '.css', '.vue'). */
export const SUPPORTED_SOURCE_EXTENSIONS: ReadonlySet<string> = new Set(
  SUPPORTED_ENTRIES.flatMap((f) => f.extensions).filter((ext) => ext.startsWith('.')),
);

/** File extensions for standalone JS/TS script files (not markup/SFC). */
export const JS_EXTENSIONS: ReadonlySet<string> = new Set(
  SUPPORTED_ENTRIES.filter((f) => SCRIPT_FORMAT_IDS.has(f.id)).flatMap((f) => f.extensions),
);

/** File extensions for JSX/TSX syntax. */
export const JSX_EXTENSIONS: ReadonlySet<string> = new Set(
  SUPPORTED_ENTRIES.filter((f) => JSX_FORMAT_IDS.has(f.id)).flatMap((f) => f.extensions),
);

/** File extensions for standalone stylesheets (.css, .scss, .less). */
export const STYLESHEET_EXTENSIONS: ReadonlySet<string> = new Set(
  SUPPORTED_ENTRIES.filter((f) => STYLESHEET_FORMAT_IDS.has(f.id)).flatMap((f) => f.extensions),
);

/** File extensions for markup and SFC formats (.html, .vue, .svelte, .astro, .gts, etc.). */
export const MARKUP_EXTENSIONS: ReadonlySet<string> = new Set(
  SUPPORTED_ENTRIES.filter((f) => MARKUP_FORMAT_IDS.has(f.id)).flatMap((f) => f.extensions),
);

// .php is excluded from *_RULE_EXTENSIONS: downstream corpus sampling depends on their exact contents.
const NON_PHP_SUPPORTED = SUPPORTED_ENTRIES.filter((f) => f.id !== 'php');

/** File extensions where the JS AST scanner runs (contents kept stable for downstream corpus sampling). */
export const JS_RULE_EXTENSIONS: readonly string[] = [
  ...new Set(
    NON_PHP_SUPPORTED.filter((f) => f.engines.includes('js')).flatMap((f) => f.extensions),
  ),
];

/** File extensions where whole stylesheets or <style> blocks are scanned for CSS rules. */
export const CSS_RULE_EXTENSIONS: readonly string[] = [
  ...new Set(
    NON_PHP_SUPPORTED.filter(
      (f) =>
        f.engines.includes('css') &&
        (STYLESHEET_FORMAT_IDS.has(f.id) || MARKUP_FORMAT_IDS.has(f.id)),
    ).flatMap((f) => f.extensions),
  ),
];

/** File extensions where DOM rules run (contents kept stable for downstream corpus sampling). */
export const DOM_RULE_EXTENSIONS: readonly string[] = [
  ...new Set(
    NON_PHP_SUPPORTED.filter((f) => f.engines.includes('dom')).flatMap((f) => f.extensions),
  ),
];

export const DEPENDENCY_RULE_FILENAMES = ['package.json'] as const;

const ENGINES_BY_EXTENSION: ReadonlyMap<string, ReadonlySet<FormatEngine>> = (() => {
  const map = new Map<string, Set<FormatEngine>>();
  for (const entry of SUPPORTED_ENTRIES) {
    for (const ext of entry.extensions) {
      if (!ext.startsWith('.')) continue;
      let set = map.get(ext);
      if (!set) {
        set = new Set();
        map.set(ext, set);
      }
      for (const engine of entry.engines) {
        set.add(engine);
      }
    }
  }
  return map;
})();

const PACKAGE_JSON_ENGINES: ReadonlySet<FormatEngine> = new Set(
  SUPPORTED_ENTRIES.find((entry) => entry.id === 'package.json')?.engines ?? ['dependency'],
);

/**
 * Returns `true` if `relPath` refers to a `package.json` manifest.
 */
export function isPackageJsonPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  return normalized === 'package.json' || normalized.endsWith('/package.json');
}

/**
 * Returns the set of supported scanner engines for a source file extension
 * (e.g. `.ts` -> `{'js', 'css'}`), or `undefined` if unsupported.
 */
export function getEnginesForSourceExtension(ext: string): ReadonlySet<FormatEngine> | undefined {
  return ENGINES_BY_EXTENSION.get(ext.toLowerCase());
}

/**
 * Returns the supported scanner engines for a file path (`package.json` or supported
 * source extension via `posix.extname`), or `undefined` if unsupported.
 */
export function getEnginesForPath(relPath: string): ReadonlySet<FormatEngine> | undefined {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  if (isPackageJsonPath(normalized)) {
    return PACKAGE_JSON_ENGINES;
  }
  return ENGINES_BY_EXTENSION.get(posix.extname(normalized));
}
