import type { AnalyzerRule } from '../schema.ts';

export {
  FORMAT_HUMAN_READABLE_DURATIONS_GUIDE_HASH,
  durationDependencyMatcher,
  durationJsMatcher,
  formatHumanReadableDurationsJsRule,
  formatHumanReadableDurationsPackageRule,
} from './calculate-event-differentials.ts';

export const formatHumanReadableDurationsRules: readonly AnalyzerRule[] = [];
