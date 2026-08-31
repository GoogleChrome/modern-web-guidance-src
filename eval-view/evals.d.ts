import type { EvalsReport } from '../harness/lib/metrics.ts';
import type { TrajectorySummary } from '../harness/lib/trajectory-normalizer.ts';

/**
 * A trial run point selected on the timeline in guide view for comparison.
 */
export interface TrialSelection {
  testId: string;
  runNumber: number;
  source?: 'local' | 'static';
  agent?: string;
  model?: string;
  score?: number;
  dateKey?: string;
  combKey?: string;
}

/**
 * State, configuration, and loaded artifacts for one side (A or B) of a comparison run.
 */
export interface CompareSide {
  key: 'A' | 'B';
  testId: string;
  runNumber: number;
  runType: 'guided' | 'unguided';
  agent: string;
  model: string;
  score: number;
  suiteData: EvalsReport | null;
  trajectory: TrajectorySummary | null;
  chatLog: string;
}

declare global {
  interface Window {
    google: any;
    __featuresMapping?: Record<string, string[]>;
    openDetailsFromTask?: (scenarioName: string, testId: string) => void;
    openTrajectory?: (usedBasePath: string, sessionFile: string) => void;
    viewContent?: (fileName: string, filePath: string) => Promise<void>;
    viewDiff?: (setupPath: string, resultPath: string, testName: string, runNumber: number) => Promise<void>;
    setInsightFilter?: (filterKey: 'agent' | 'serving' | 'model', value: string) => void;
    switchTab?: (tab: string) => void;
    switchTask?: (task: string) => Promise<void> | void;
    runDiagnosticAgent?: () => Promise<void>;
    switchTimelineMode?: (mode: 'milestone' | 'raw') => void;
    exportCompareReport?: () => void;
  }
}
