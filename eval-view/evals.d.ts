import type { EvalsReport } from '../harness/lib/metrics.ts';
import type { StandardizedStep, TrajectorySummary } from '../harness/lib/trajectory-normalizer.ts';

export type SuiteReport = EvalsReport & {
  enableSkills?: boolean;
};

export type CompareStep = Omit<StandardizedStep, 'action' | 'outcome'> & {
  action?: {
    type?: string;
    name?: string;
    params?: any;
    canonicalCategory?: string;
  };
  outcome?: any;
  output?: any;
  result?: any;
};

export type CompareTrajectory = TrajectorySummary & {
  steps: CompareStep[];
};

/**
 * A trial point selected on the timeline in guide view for comparison.
 */
export interface SelectedTrialPoint {
  testId: string;
  dateKey?: string;
  combKey?: string;
  runIndex?: number;
  source?: string;
  agent?: string;
  model?: string;
  score?: number;
}

/**
 * State, configuration, and loaded artifacts for one side (A or B) of a comparison run.
 */
export interface CompareSide extends SelectedTrialPoint {
  key: 'A' | 'B';
  label: string;
  trialId: string;
  runNum: string;
  score: number;
  scoreParam: string | null;
  runType: 'guided' | 'unguided';
  runDir: string;
  suiteData: SuiteReport | null;
  trajectory: CompareTrajectory | null;
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
