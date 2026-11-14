import type { EvalsReport } from '../harness/lib/metrics.ts';
import type { ReasoningEffort, ReasoningEffortSource } from '../harness/lib/reasoning-effort.ts';
import type { TrajectorySummary } from '../harness/lib/trajectory-normalizer.ts';
import type { JobSummary, SuiteSummary } from './summary-extractor.js';

export type { EvalsReport, JobSummary, ReasoningEffort, ReasoningEffortSource, SuiteSummary, TrajectorySummary };

declare global {
  interface Window {
    google: any;
    __featuresMapping?: Record<string, string[]>;
    openDetailsFromTask?: (taskKey: string, testId: string) => void;
    openTrajectory?: (usedBasePath: string, sessionFile: string) => void;
    setInsightFilter?: (filterKey: 'agent' | 'model', value: string, effort?: string) => void;
  }
}
