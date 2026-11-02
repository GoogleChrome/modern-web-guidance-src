import type { EvalsReport } from '../harness/lib/metrics.ts';



declare global {
  interface Window {
    google: any;
    __featuresMapping?: Record<string, string[]>;
    openDetailsFromTask?: (scenarioName: string, testId: string) => void;
    openTrajectory?: (usedBasePath: string, sessionFile: string) => void;
    setInsightFilter?: (filterKey: 'agent' | 'serving' | 'model', value: string) => void;
  }
}
