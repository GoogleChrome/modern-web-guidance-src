import type { EvalsReport } from '../harness/lib/metrics.ts';



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
