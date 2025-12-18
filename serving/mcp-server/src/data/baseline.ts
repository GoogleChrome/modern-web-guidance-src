import { features } from 'web-features';

export type BaselineStatus = 'Limited availability' | `Baseline since ${string}`;

type Feature = typeof features[string];

/**
 * Gets the Baseline status for a specific feature.
 * @param featureId - The ID of the web feature
 * @returns The Baseline status of the feature ('Limited availability' or 'Baseline since YYYY-MM-DD')
 */
export function getBaselineStatus(featureId: string): BaselineStatus | undefined {
  const resolvedIds = resolveFeatureId(featureId);
  if (resolvedIds.length === 0) {
    return;
  }

  let latestDate = "0000-00-00";

  for (const id of resolvedIds) {
    const feature = features[id] as Feature;
    if (!feature.status?.baseline_low_date) {
      return 'Limited availability';
    }
    if (feature.status.baseline_low_date > latestDate) {
      latestDate = feature.status.baseline_low_date;
    }
  }

  return `Baseline since ${latestDate}`;
}

/**
 * Checks if a feature satisfies a specific Baseline target.
 * Supports standard statuses and date-based targets by resolving 
 * everything to a required "Baseline low date".
 * 
 * - "Limited": Always true (if feature exists, or even if not, consistent with legacy behavior)
 * - "Newly" / "Baseline": Requires baseline_low_date <= today
 * - "Widely": Requires baseline_low_date <= today - 30 months
 * - "Baseline YYYY": Requires baseline_low_date <= YYYY-12-31
 * - "Baseline Widely available on YYYY-MM-DD": Requires baseline_low_date <= TargetDate - 30 months
 * 
 * @param target - The Baseline target string
 * @param featureId - The ID of the feature to check
 * @returns true if the feature meets the target criteria
 */
export function checkBaseline(target: string, featureId: string): boolean {
  const normalizedTarget = target.toLowerCase();

  // 1. Handle "Limited" - matches everything
  if (normalizedTarget.includes('limited')) {
    return true;
  }

  // 2. Resolve Target to a Required Low Date
  let requiredLowDate: string;

  const yearMatch = target.match(/^baseline (\d{4})$/i);
  const dateMatch = target.match(/^baseline widely available on (\d{4}-\d{2}-\d{2})$/i);

  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    // "Baseline 2024" -> Available by end of 2024
    requiredLowDate = `${year}-12-31`;
  } else if (dateMatch) {
    // "Baseline Widely available on X" -> Low date was 30 months before X
    requiredLowDate = subtractMonths(dateMatch[1], 30);
  } else {
    // Relative targets (Newly, Widely)
    const now = new Date().toISOString().split('T')[0];

    if (normalizedTarget.includes('widely')) {
      requiredLowDate = subtractMonths(now, 30);
    } else if (normalizedTarget.includes('newly') || normalizedTarget.includes('baseline')) {
      requiredLowDate = now;
    } else {
      return false;
    }
  }

  // 3. Verify feature meets requirement using getBaselineStatus
  const status = getBaselineStatus(featureId);

  if (!status || status === 'Limited availability') {
    return false;
  }

  // Status is "Baseline since YYYY-MM-DD"
  const featureDate = status.replace('Baseline since ', '');
  return featureDate <= requiredLowDate;
}

/**
 * Resolves the feature ID to its canonical form, following any number of splits and redirects.
 * @param featureId - The feature ID to resolve
 * @returns An array of canonical feature IDs (multiple if split)
 */
export function resolveFeatureId(featureId: string): string[] {
  const feature = features[featureId] as Feature | undefined;
  if (!feature) {
    return [];
  }
  if (feature.kind === "feature") {
    return [featureId];
  }
  if (feature.kind === "moved") {
    return resolveFeatureId(feature.redirect_target);
  }
  if (feature.kind === "split") {
    return feature.redirect_targets.flatMap(resolveFeatureId);
  }
  return [];
}

/**
 * Gets the baseline status for a specific browser compatibility key.
 * @param featureId - Optional feature ID to search within (improves performance if known)
 * @param bcdKey - The browser compatibility data key (e.g., "api.HTMLElement.focus")
 * @returns The baseline status object for the key, or undefined if not found
 */
export function getStatus(
  featureId: string | undefined,
  bcdKey: string,
): { baseline?: 'high' | 'low' | false } | undefined {
  // Direct lookup when feature ID is provided
  if (featureId) {
    // Handle splits and redirects
    const resolvedFeatureIds = resolveFeatureId(featureId);
    if (resolvedFeatureIds.length === 0) {
      return;
    }
    for (const resolvedFeatureId of resolvedFeatureIds) {
      const feature = features[resolvedFeatureId] as Feature;
      if (feature.kind !== 'feature') {
        continue;
      }
      if (feature.status?.by_compat_key?.[bcdKey]) {
        return feature.status.by_compat_key[bcdKey];
      }
    }
  }

  // Fall back to searching all features when no feature ID is provided
  for (const feature of Object.values(features) as Feature[]) {
    if (feature.kind !== "feature") {
      continue;
    }
    if (feature.status?.by_compat_key?.[bcdKey]) {
      return feature.status.by_compat_key[bcdKey];
    }
  }
}

/**
 * Subtracts a specified number of months from a date string.
 * @param dateStr - The date string in the format "YYYY-MM-DD"
 * @param months - The number of months to subtract
 * @returns The date string after subtracting the specified number of months
 */
function subtractMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}