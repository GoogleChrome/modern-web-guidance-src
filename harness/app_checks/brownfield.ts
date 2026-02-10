import type { ScenarioCheck } from '../lib/metrics.ts';
import { checkSpeculationRules } from './speculation_rules.ts';

export default async function checkBrownfield(dirPath: string, files: string[]): Promise<ScenarioCheck[]> {
  const results: ScenarioCheck[] = [];

  // Speculation Rules Checks
  results.push(...await checkSpeculationRules(dirPath, files));

  return results;
};
