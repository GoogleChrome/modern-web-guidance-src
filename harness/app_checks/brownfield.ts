import type { ScenarioCheck } from '../lib/metrics.ts';
import { checkSpeculationRules } from './speculation_rules.ts';
import { checkInterestInvokers } from './interest_invokers.ts';
import { checkLoadingPlaceholders } from './loading_placeholders.ts';
import { checkCssFeatures } from './css_features.ts';
import { checkLegacyPatterns } from './legacy_patterns.ts';

export default async function checkBrownfield(dirPath: string, files: string[]): Promise<ScenarioCheck[]> {
  const results: ScenarioCheck[] = [];

  // Speculation Rules Checks
  results.push(...await checkSpeculationRules(dirPath, files));

  // Interest Invokers Checks (formerly greenfield/redfield)
  results.push(...await checkInterestInvokers(dirPath, files));

  // Loading Placeholders Checks (formerly greenfield)
  results.push(...await checkLoadingPlaceholders(dirPath, files));

  // CSS Features Checks (formerly greenfield)
  results.push(...await checkCssFeatures(dirPath, files));

  // Legacy Patterns Checks (formerly redfield)
  results.push(...await checkLegacyPatterns(dirPath, files));

  return results;
};
