import { features } from 'web-features';

type Feature = typeof features[string];

export interface DetailedBaselineStatus {
  baseline: 'low' | 'high' | false;
  baseline_low_date?: string;
  baseline_high_date?: string;
}

/**
 * Resolves the feature ID to its canonical form, following moves and splits.
 */
export function resolveFeatureId(featureId: string): string[] {
  const feature = features[featureId] as Feature | undefined;
  if (!feature) return [];
  if (feature.kind === "feature") return [featureId];
  if (feature.kind === "moved") return resolveFeatureId(feature.redirect_target);
  if (feature.kind === "split") return feature.redirect_targets.flatMap(resolveFeatureId);
  return [];
}

/**
 * Gets the detailed Baseline status for a specific feature, resolving redirects/splits.
 */
export function getFeatureStatus(featureId: string): DetailedBaselineStatus | undefined {
  const resolvedIds = resolveFeatureId(featureId);
  if (resolvedIds.length === 0) return;

  let latestLowDate = "0000-00-00";
  let latestHighDate = "0000-00-00";
  let overallBaseline: 'low' | 'high' | false = 'high';

  for (const id of resolvedIds) {
    const feature = features[id] as Feature;
    if (feature.kind !== 'feature' || !feature.status) {
      overallBaseline = false;
      continue;
    }
    
    const status = feature.status;
    if (status.baseline === false) overallBaseline = false;
    else if (status.baseline === 'low' && overallBaseline === 'high') overallBaseline = 'low';

    if (status.baseline_low_date && status.baseline_low_date > latestLowDate) {
      latestLowDate = status.baseline_low_date;
    }
    if (status.baseline_high_date && status.baseline_high_date > latestHighDate) {
      latestHighDate = status.baseline_high_date;
    }
  }

  return {
    baseline: overallBaseline,
    baseline_low_date: latestLowDate === "0000-00-00" ? undefined : latestLowDate,
    baseline_high_date: latestHighDate === "0000-00-00" ? undefined : latestHighDate
  };
}

/**
 * Maps baseline internal values to human-readable terms.
 */
export function mapBaseline(baseline: string | boolean | undefined): string {
  if (baseline === 'low') return 'Newly available';
  if (baseline === 'high') return 'Widely available';
  if (baseline === false) return 'Limited availability';
  return 'unknown';
}
