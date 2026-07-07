/**
 * Centralized matrix mapping each guide (by its path relative to the guides/ directory)
 * to its target base applications.
 *
 * If a guide is not listed here, it defaults to using 'daily-grind'.
 */
export const EVALUATION_MATRIX: Record<string, { baseApps: string[] }> = {
  'forms/autofill-sign-in-form': { baseApps: ['devtools-times'] },
  'performance/calculate-total-foreground-time': { baseApps: ['analytics-dashboard'] },
  'performance/defer-rendering-heavy-content': { baseApps: ['cards-app'] },
  'performance/deprioritize-background-fetches': { baseApps: ['empty-app'] },
  'performance/full-session-analytics': { baseApps: ['cards-app'] },
  'performance/optimize-image-priority': { baseApps: ['empty-app'] },
  'performance/optimize-preload-priority': { baseApps: ['empty-app'] },
  'performance/optimize-script-priority': { baseApps: ['empty-app'] },
};

/**
 * Returns the list of target base apps for a given guide directory path (e.g. "forms/autofill-sign-in-form").
 */
export function getBaseAppsForGuide(guideRelativePath: string): string[] {
  const normalized = guideRelativePath.replace(/\\/g, '/'); // Normalize Windows paths
  return EVALUATION_MATRIX[normalized]?.baseApps || ['daily-grind'];
}
