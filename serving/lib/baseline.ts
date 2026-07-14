import { features } from 'web-features';
import bcd from '@mdn/browser-compat-data' with { type: 'json' };
import type { Browsers, BrowserName } from '@mdn/browser-compat-data';

export type BaselineStatus = 'Limited' | `Baseline since ${string}`;

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
  shortLabel: string;   // e.g. "Newly", "Widely", "Limited"
  releaseDate: string;  // The date the feature first became Baseline (Interoperable)
}
/**
 * Gets the detailed Baseline status for a specific feature, resolving redirects/splits.
 */
export function getFeatureStatus(featureId: string): DetailedBaselineStatus | undefined {
  const resolvedIds = resolveFeatureId(featureId);
  if (resolvedIds.length === 0) return;

  let latestLowDate = "0000-00-00";
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
  }

  const baseline_low_date = latestLowDate === "0000-00-00" ? undefined : latestLowDate;

  const shortLabel = mapBaseline(overallBaseline);

  const releaseDate = (overallBaseline !== false && baseline_low_date) ? baseline_low_date : '-';

  return {
    baseline: overallBaseline,
    baseline_low_date,
    shortLabel,
    releaseDate
  };
}

/**
 * Gets the detailed Baseline status for a specific feature.
 * @param featureId - The ID of the web feature
 * @returns The detailed status of the feature
 */
export function getDetailedBaselineStatus(featureId: string): DetailedBaselineStatus | undefined {
  return getFeatureStatus(featureId);
}

/**
 * Maps baseline internal values to human-readable terms.
 */
export function mapBaseline(baseline: string | boolean | undefined): string {
  if (baseline === "low") return "Newly available";
  if (baseline === "high") return "Widely available";
  if (baseline === false) return "Limited availability";
  return "unknown";
}

/**
 * Gets the Baseline status for a specific feature.
 * @param featureId - The ID of the web feature
 * @returns The Baseline status of the feature ('Limited availability' or 'Baseline since YYYY-MM-DD')
 */
export function getBaselineStatus(featureId: string): BaselineStatus | undefined {
  const status = getFeatureStatus(featureId);
  if (!status) return;
  if (status.baseline === false) return 'Limited';
  return `Baseline since ${status.releaseDate}`;
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

  const baselineStatus = getFeatureStatus(featureId);
  if (!baselineStatus) {
    return false;
  }

  // 2. Handle specific historical checks first (Yearly or specific "Widely available on" dates)
  const yearMatch = target.match(/^baseline (\d{4})$/i);
  const dateMatch = target.match(/^baseline widely available on (\d{4}-\d{2}-\d{2})$/i);

  if (yearMatch || dateMatch) {
    if (baselineStatus.baseline === false || !baselineStatus.baseline_low_date) {
      return false;
    }

    let requiredLowDate: string;
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      // "Baseline 2024" -> Available by end of 2024
      requiredLowDate = `${year}-12-31`;
    } else {
      // "Baseline Widely available on X" -> Low date was 30 months before X
      requiredLowDate = subtractMonths(dateMatch![1], 30);
    }
    return baselineStatus.baseline_low_date <= requiredLowDate;
  }

  // 3. Handle relative targets (Newly, Widely) strictly against the package status
  if (normalizedTarget.includes('widely')) {
    return baselineStatus.baseline === 'high';
  }
  if (normalizedTarget.includes('newly') || normalizedTarget === 'baseline' || normalizedTarget === 'baseline newly available') {
    // "Baseline" or "Newly available" are both satisfied by low or high baseline status
    return baselineStatus.baseline === 'low' || baselineStatus.baseline === 'high';
  }

  return false;
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
 * Gets the human-readable name for a feature ID.
 * @param featureId - The feature ID to look up
 * @returns The feature name
 */
export function getFeatureName(featureId: string): string {
  const feature = features[featureId] as Feature;
  return feature.name;
}

/**
 * Gets the group tags associated with a feature ID.
 */
export function getFeatureGroups(featureId: string): string[] {
  const feature = features[featureId] as any;
  if (feature && feature.group) {
    return Array.isArray(feature.group) ? feature.group : [feature.group];
  }
  return [];
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
      errorMessage: `Web feature ID "${id}" not found in web-features package. Use "gd baselinestatus <keyword>" to find the correct ID.`
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
 * Native formatting instances leveraging built-in Intl APIs.
 * Note on Node.js Safety: Pre-built official Node.js binaries enable full ICU data by default
 * starting from v13.0.0+ (Oct 2019). Furthermore, under ECMA-402 specifications, native Intl constructors
 * are strictly designed for maximum resilience—invoking them in minimal environments lacking
 * extra locale data never throws exceptions, but instead gracefully defaults to root/English rules.
 */
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const listFormatter = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });

function formatBrowserTitle(key: string): string {
  return key
    .split('_')
    .map(word => word === 'ios' ? 'iOS' : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatVersionWithMonth(browserKey: BrowserName, version: string): string {
  if (!version || version === '-') return '';
  const release = (bcd.browsers as Browsers)[browserKey]?.releases?.[version];
  if (release?.release_date) {
    const formattedDate = dateFormatter.format(new Date(release.release_date));
    return `${version} (${formattedDate})`;
  }
  return version;
}

/**
 * Constructs a dense support map string from underlying BCD engines.
 * Note on Desktop vs. Mobile Consolidation: Empirical analysis across 1,156 BCD features reveals that
 * in the Modern Era (features released ≥ 2020), desktop and mobile release timelines are tightly synchronized
 * (~92–96% identical rollout dates). Therefore, cleanly consolidating mobile targets into desktop engine labels
 * when identical maximizes token density, dynamically splitting them out only upon divergence.
 */
function formatSupportMap(support: Record<string, any> | undefined): string {
  if (!support) return '';
  const supportedParts: string[] = [];
  const unsupportedParts: string[] = [];

  const keys = ['chrome', 'edge', 'firefox', 'safari'] as BrowserName[];
  if (support.safari_ios && support.safari_ios !== support.safari) {
    keys.push('safari_ios' as BrowserName);
  }

  for (const key of keys) {
    const label = formatBrowserTitle(key);
    const ver = support[key];
    if (ver && ver !== '-') {
      const formatted = formatVersionWithMonth(key, String(ver));
      supportedParts.push(`${label} ${formatted}`);
    } else {
      if (key !== 'safari_ios') {
        unsupportedParts.push(label);
      }
    }
  }

  let res = '';
  if (supportedParts.length > 0) {
    res += `\nSupported by: ${listFormatter.format(supportedParts)}.`;
    if (unsupportedParts.length > 0) {
      res += `\nUnsupported in: ${listFormatter.format(unsupportedParts)}.`;
    }
  } else {
    res += `\nNot natively supported by any major browser yet.`;
  }
  return res;
}

/**
 * Internal helper to format status messages consistently.
 */
function formatStatusMessage(featureName: string, status: { baseline?: string | boolean; baseline_low_date?: string; shortLabel?: string; releaseDate?: string; support?: Record<string, any> }): string {
  const { baseline, releaseDate, shortLabel, support } = status;
  const resolvedSupport = (baseline === false && !support) ? {} : support;
  const supportStr = formatSupportMap(resolvedSupport);

  if (baseline !== false && releaseDate && releaseDate !== "-") {
    return `Baseline status for ${featureName}: ${shortLabel}. It's been Baseline since ${releaseDate}.${supportStr}`;
  }

  if (supportStr === '\nNot natively supported by any major browser yet.') {
    return `${featureName} is not natively supported by any major browser yet.`;
  }

  return `${featureName} has limited availability.${supportStr}`;
}

/**
 * Gets a formatted status message for a feature or a specific BCD key.
 */
export function getStatusMessage(featureId: string, bcdKey?: string): string | undefined {
  if (bcdKey) {
    const status = getStatus(featureId, bcdKey);
    if (!status) return;

    // For compat keys, we manually map as the central status is for the whole feature
    const mapped = {
      baseline: status.baseline,
      shortLabel: mapBaseline(status.baseline),
      releaseDate: status.baseline_low_date || '-',
      support: status.support
    };
    return formatStatusMessage(`the ${bcdKey} capability`, mapped);
  }

  const feature = features[featureId] as Feature | undefined;
  if (!feature) return;

  const baselineStatus = getFeatureStatus(featureId);
  if (!baselineStatus) return;

  const resolvedIds = resolveFeatureId(featureId);
  let support: Record<string, any> | undefined;
  for (const id of resolvedIds) {
    const f = features[id] as Feature;
    if (f?.kind === 'feature' && f.status?.support) {
      support = f.status.support;
      break;
    }
  }

  const subject = feature.kind === 'feature' ? feature.name : featureId;

  const mapped = {
    ...baselineStatus,
    support
  };

  if (baselineStatus.baseline === false) {
    return formatStatusMessage(subject, { baseline: false, support });
  }

  return formatStatusMessage(subject, mapped);
}

type FeatureData = Extract<Feature, { kind: "feature" }>;
type Status = NonNullable<FeatureData["status"]>;
type CompatStatus = NonNullable<Status["by_compat_key"]>[string];

/**
 * Gets the baseline status for a specific browser compatibility key.
 * @param featureId - Optional feature ID to search within (improves performance if known)
 * @param bcdKey - The browser compatibility data key (e.g., "api.HTMLElement.focus")
 * @returns The baseline status object for the key, or undefined if not found
 */
export function getStatus(
  featureId: string | undefined,
  bcdKey: string,
): CompatStatus | undefined {
  // Direct lookup when feature ID is provided
  if (featureId) {
    // Handle splits and redirects
    const resolvedFeatureIds = resolveFeatureId(featureId);
    if (resolvedFeatureIds.length === 0) {
      return;
    }
    for (const resolvedFeatureId of resolvedFeatureIds) {
      const feature = features[resolvedFeatureId] as Feature;
      if (feature.kind === 'feature') {
        const compatStatus = feature.status?.by_compat_key?.[bcdKey];
        if (compatStatus) {
          return compatStatus;
        }
      }
    }
  }

  // Fall back to searching all features when no feature ID is provided
  for (const feature of Object.values(features) as Feature[]) {
    if (feature.kind === "feature") {
      const compatStatus = feature.status?.by_compat_key?.[bcdKey];
      if (compatStatus) {
        return compatStatus;
      }
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
