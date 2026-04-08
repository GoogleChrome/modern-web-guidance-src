import type { Metrics, RunResult as HarnessRunResult } from '../harness/lib/metrics.ts';

export interface FullRunResult extends HarnessRunResult {
  taskName?: string;
  baseApp?: string;
  prompt?: string;
}

export interface EvalsReport {
  summary: Metrics['summary'];
  results: Record<string, FullRunResult[]>;
  stats: Metrics['testStats'];
  timestamp: string;
  runCount: number;
  agent: string;
  serving: string;
  model: string;
}

export interface LooseEvalsReport extends Partial<Omit<EvalsReport, 'results'>> {
  results?: Record<string, any>;
  [key: string]: any;
}

declare global {
  interface Window {
    google: any;
  }
}
