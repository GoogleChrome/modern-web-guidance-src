import type { AnalyzerRule } from '../schema.ts';

export {
  MANAGE_RECURRING_INTERVALS_GUIDE_HASH,
  manageRecurringIntervalsMatcher,
  manageRecurringIntervalsRule,
} from './capture-location-agnostic-data.ts';

export const manageRecurringIntervalsRules: readonly AnalyzerRule[] = [];
