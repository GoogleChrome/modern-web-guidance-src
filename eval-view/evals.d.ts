import type { EvalsReport } from '../harness/lib/metrics.ts';

export interface LooseEvalsReport extends Partial<Omit<EvalsReport, 'results'>> {
  results?: Record<string, any>;
  [key: string]: any;
}

declare global {
  interface Window {
    google: any;
  }
}
