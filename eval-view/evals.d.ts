import type { EvalsReport } from '../harness/lib/metrics.ts';



declare global {
  interface Window {
    google: any;
    __featuresMapping: any;
  }
}
