export interface CategoryEntry {
  slug: string;
  title: string;
}

export const CATEGORIES: readonly CategoryEntry[] = [
  // 1. UI & Design
  { slug: 'visual-design', title: 'Visual Design' },
  { slug: 'ui-atoms', title: 'UI Atoms' },
  { slug: 'ui-components', title: 'UI Components' },
  { slug: 'ui-behaviors', title: 'UI Behaviors' },
  { slug: 'user-experience', title: 'User Experience' },
  { slug: 'forms', title: 'Forms' },
  // 2. Foundations
  { slug: 'html', title: 'HTML' },
  { slug: 'css', title: 'CSS' },
  { slug: 'js', title: 'JavaScript' },
  { slug: 'wasm', title: 'WebAssembly' },
  // 3. Quality & Trust
  { slug: 'performance', title: 'Performance' },
  { slug: 'accessibility', title: 'Accessibility' },
  { slug: 'security', title: 'Security' },
  { slug: 'privacy', title: 'Privacy' },
  // 4. Emerging & App Capabilities
  { slug: 'pwa', title: 'PWA' },
  { slug: 'built-in-ai', title: 'Built-in AI' },
  { slug: 'webmcp', title: 'WebMCP' },
];

const CATEGORY_MAP = new Map<string, CategoryEntry>(
  CATEGORIES.map(cat => [cat.slug, cat])
);

const CATEGORY_INDEX = new Map<string, number>(
  CATEGORIES.map((cat, index) => [cat.slug, index])
);

export function getCategoryTitle(slug: string): string {
  const entry = CATEGORY_MAP.get(slug);
  if (!entry) {
    throw new Error(`Unknown category "${slug}". Register it in src/core/categories.ts.`);
  }
  return entry.title;
}

export function getCategoryIndex(slug: string): number {
  const index = CATEGORY_INDEX.get(slug);
  if (index === undefined) {
    throw new Error(`Unknown category "${slug}". Register it in src/core/categories.ts.`);
  }
  return index;
}

export function isKnownCategory(slug: string): boolean {
  return CATEGORY_MAP.has(slug);
}
