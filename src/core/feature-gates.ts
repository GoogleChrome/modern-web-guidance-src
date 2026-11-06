import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './paths.ts';

export interface OriginTrialEntry {
  name?: string;
  chromestatus_url?: string;
}

export interface VolatileFeatureEntry {
  reason?: string;
}

export interface OriginTrialMetadata extends OriginTrialEntry {
  readonly id: string;
}

export interface VolatileFeatureMetadata extends VolatileFeatureEntry {
  readonly id: string;
}

export interface FeatureGateSpec<T extends { id: string } = { id: string }> {
  id: 'origin-trials' | 'volatile-features';
  optInKey: 'allowOriginTrials' | 'allowVolatileFeatures';
  cliCommand: 'set-allow-origin-trials' | 'set-allow-volatile-features';
  headingLabel: string;
  promptLabel: string;
  riskAdjective: string;
  registryRelativePath: string;
  formatSummary: (features: T[]) => string;
}

export const FEATURE_GATES = {
  'origin-trials': {
    id: 'origin-trials',
    optInKey: 'allowOriginTrials',
    cliCommand: 'set-allow-origin-trials',
    headingLabel: 'Origin Trial features',
    promptLabel: 'experimental Origin Trial guidance',
    riskAdjective: 'experimental',
    registryRelativePath: 'features/origin-trials.json',
    formatSummary: (features: OriginTrialMetadata[]) => {
      const ids = features.map((f) => f.id).join(', ');
      const uniqueUrls = [...new Set(features.map((f) => f.chromestatus_url).filter(Boolean))].join(', ');
      const urlSuffix = uniqueUrls ? ` (${uniqueUrls})` : '';
      const singular = features.length === 1;
      return `${singular ? 'an active Origin Trial' : 'active Origin Trials'} (${ids})${urlSuffix}`;
    },
  },
  'volatile-features': {
    id: 'volatile-features',
    optInKey: 'allowVolatileFeatures',
    cliCommand: 'set-allow-volatile-features',
    headingLabel: 'volatile features',
    promptLabel: 'volatile feature guidance',
    riskAdjective: 'shipped in only a single browser engine',
    registryRelativePath: 'features/volatile-features.json',
    formatSummary: (features: VolatileFeatureMetadata[]) => {
      const ids = features.map((f) => f.id).join(', ');
      const singular = features.length === 1;
      return `${singular ? 'a volatile feature' : 'volatile features'} (${ids})`;
    },
  },
} as const satisfies Record<string, FeatureGateSpec<any>>;

export type FeatureGateId = keyof typeof FEATURE_GATES;

export const DEFAULT_GUIDED_MWGRC: Record<'allowOriginTrials' | 'allowVolatileFeatures', true> = {
  allowOriginTrials: true,
  allowVolatileFeatures: true,
};

const registryCache = new Map<string, Record<string, any>>();

function loadRegistry<T>(relativePath: string): Record<string, T> {
  if (registryCache.has(relativePath)) {
    return registryCache.get(relativePath) as Record<string, T>;
  }
  const fullPath = path.join(rootDir, relativePath);
  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(raw);
    registryCache.set(relativePath, parsed);
    return parsed;
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 'ENOENT') {
      registryCache.set(relativePath, {});
      return {} as Record<string, T>;
    }
    throw new Error(`Failed to parse registry at ${fullPath}: ${(e as Error).message}`);
  }
}

export function resetRegistryCache(): void {
  registryCache.clear();
}

export function isVolatileActive(entry?: VolatileFeatureEntry): boolean {
  return entry !== undefined;
}

export function getOriginTrialsRegistry(): Record<string, OriginTrialEntry> {
  return loadRegistry<OriginTrialEntry>(FEATURE_GATES['origin-trials'].registryRelativePath);
}

export function getVolatileFeaturesRegistry(): Record<string, VolatileFeatureEntry> {
  return loadRegistry<VolatileFeatureEntry>(FEATURE_GATES['volatile-features'].registryRelativePath);
}

export function getOriginTrialMetadata(featureId: string): OriginTrialMetadata | undefined {
  const registry = getOriginTrialsRegistry();
  const entry = registry[featureId];
  return entry ? { ...entry, id: featureId } : undefined;
}

export function getGuideOriginTrials(featureIds: string[]): OriginTrialMetadata[] {
  const registry = getOriginTrialsRegistry();
  const found: OriginTrialMetadata[] = [];
  for (const id of featureIds) {
    if (registry[id]) {
      found.push({ ...registry[id], id });
    }
  }
  return found;
}

export function getGuideVolatileFeatures(featureIds: string[]): VolatileFeatureMetadata[] {
  const registry = getVolatileFeaturesRegistry();
  const found: VolatileFeatureMetadata[] = [];
  for (const id of featureIds) {
    const entry = registry[id];
    if (entry) {
      found.push({ ...entry, id });
    }
  }
  return found;
}
