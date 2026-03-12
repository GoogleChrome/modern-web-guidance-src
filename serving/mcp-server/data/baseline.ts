import { features } from 'web-features';

export type BaselineStatus = 'Limited availability' | `Baseline since ${string}`;

type Feature = typeof features[string];

/**
 * Result of a feature validation check.
 */
export interface FeatureValidationResult {
  isValid: boolean;
  error?: 'not_found' | 'invalid_kind';
  kind?: string;
  suggestion?: string;
  errorMessage?: string;
}

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
 * Gets the detailed Baseline status for a specific feature.
 * (Legacy wrapper for getFeatureStatus)
 */
export function getDetailedBaselineStatus(featureId: string): DetailedBaselineStatus | undefined {
  return getFeatureStatus(featureId);
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

/**
 * Gets the Baseline status for a specific feature.
 */
export function getBaselineStatus(featureId: string): BaselineStatus | undefined {
  const status = getFeatureStatus(featureId);
  if (!status) return;
  if (status.baseline === false) return 'Limited availability';
  return `Baseline since ${status.baseline_low_date}`;
}

/**
 * Checks if a feature satisfies a specific Baseline target.
 */
export function checkBaseline(target: string, featureId: string): boolean {
  const normalizedTarget = target.toLowerCase();

  if (normalizedTarget.includes('limited')) return true;

  const baselineStatus = getFeatureStatus(featureId);
  if (!baselineStatus) return false;

  const yearMatch = target.match(/^baseline (\d{4})$/i);
  const dateMatch = target.match(/^baseline widely available on (\d{4}-\d{2}-\d{2})$/i);

  if (yearMatch || dateMatch) {
    if (baselineStatus.baseline === false || !baselineStatus.baseline_low_date) return false;

    let requiredLowDate: string;
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      requiredLowDate = `${year}-12-31`;
    } else {
      requiredLowDate = subtractMonths(dateMatch![1], 30);
    }
    return baselineStatus.baseline_low_date <= requiredLowDate;
  }

  if (normalizedTarget.includes('widely')) return baselineStatus.baseline === 'high';
  if (normalizedTarget.includes('newly') || normalizedTarget === 'baseline' || normalizedTarget === 'baseline newly available') {
    return baselineStatus.baseline === 'low' || baselineStatus.baseline === 'high';
  }

  return false;
}

/**
 * Validates a feature ID.
 */
export function validateFeature(id: string): FeatureValidationResult {
  const feature = features[id] as Feature | undefined;
  if (!feature) {
    return {
      isValid: false,
      error: 'not_found',
      errorMessage: `Web feature ID "${id}" not found in web-features package`
    };
  }
  if (feature.kind !== 'feature') {
    let suggestion: string | undefined;
    let suggestionStr = '';
    if (feature.kind === 'moved') {
      suggestion = feature.redirect_target;
      suggestionStr = ` (It has been moved to "${suggestion}")`;
    } else if (feature.kind === 'split') {
      suggestion = feature.redirect_targets.join(', ');
      suggestionStr = ` (It has been split into: ${suggestion})`;
    }
    return {
      isValid: false,
      error: 'invalid_kind',
      kind: feature.kind,
      suggestion,
      errorMessage: `Web feature ID "${id}" is a ${feature.kind} record, not a primary feature${suggestionStr}`
    };
  }
  return { isValid: true };
}

/**
 * Internal helper to format status messages consistently.
 */
function formatStatusMessage(featureName: string, status: { baseline?: string | boolean; baseline_low_date?: string }): string {
  const { baseline, baseline_low_date } = status;

  if ((baseline === 'low' || baseline === 'high') && baseline_low_date) {
    return `${featureName} is ${mapBaseline(baseline)}. It's been Baseline since ${baseline_low_date}.`;
  }

  return `${featureName} is not supported across all major browsers.`;
}

/**
 * Gets a formatted status message for a feature or a specific BCD key.
 */
export function getStatusMessage(featureId: string, bcdKey?: string): string | undefined {
  if (bcdKey) {
    const status = getStatus(featureId, bcdKey);
    if (!status) return;
    return formatStatusMessage(`The ${bcdKey} capability`, status);
  }

  const feature = features[featureId] as Feature | undefined;
  if (!feature) return;

  const baselineStatus = getFeatureStatus(featureId);
  if (!baselineStatus) return;

  const subject = (feature as any).name || featureId;

  if (baselineStatus.baseline === false) {
    return formatStatusMessage(subject, { baseline: false });
  }

  return formatStatusMessage(subject, {
    baseline: baselineStatus.baseline,
    baseline_low_date: baselineStatus.baseline_low_date
  });
}

type FeatureData = Extract<Feature, { kind: "feature" }>;
type Status = NonNullable<FeatureData["status"]>;
type CompatStatus = NonNullable<Status["by_compat_key"]>[string];

/**
 * Gets the baseline status for a specific browser compatibility key.
 */
export function getStatus(
  featureId: string | undefined,
  bcdKey: string,
): CompatStatus | undefined {
  if (featureId) {
    const resolvedFeatureIds = resolveFeatureId(featureId);
    if (resolvedFeatureIds.length === 0) return;
    
    for (const resolvedFeatureId of resolvedFeatureIds) {
      const feature = features[resolvedFeatureId] as Feature;
      if (feature.kind !== 'feature') continue;
      if (feature.status?.by_compat_key?.[bcdKey]) {
        return feature.status.by_compat_key[bcdKey];
      }
    }
  }

  for (const feature of Object.values(features) as Feature[]) {
    if (feature.kind !== "feature") continue;
    if (feature.status?.by_compat_key?.[bcdKey]) {
      return feature.status.by_compat_key[bcdKey];
    }
  }
}

function subtractMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}