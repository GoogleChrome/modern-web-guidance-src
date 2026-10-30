/**
 * Orientation guides that provide high-level, cross-cutting guidance
 * across a discipline rather than a single task-based use case.
 */
export const DISCIPLINE_GUIDES = new Set([
  // Category root guides
  'accessibility',
  'css',
  'forms',
  'html',
  'performance',
  'privacy',
  'security',
  'webmcp',

  // Named orientation guides
  'browser-ui-theming',
  'color',
  'cpp-on-the-web',
  'css-conditionals',
  'css-layout',
  'motion',
  'passkeys',
  'responsive-design',
  'typography',
  'visual-effects',
  'web-components',
]);

/**
 * Returns true if a guide is a discipline-level orientation guide.
 */
export function isDisciplineGuide(name: string, category?: string): boolean {
  return (category !== undefined && name === category) || DISCIPLINE_GUIDES.has(name);
}
