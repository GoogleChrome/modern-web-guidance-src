import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { DetectiveFactCheck, JudgeVerdict } from './detection-eval.ts';
import { WORKTREE_ROOT } from './paths.ts';
import type { Phase2Confidence } from './llm-verifier.ts';
import type { AnalyzerRule } from './schema.ts';

export const CARD_TELEMETRY_PATH = join(
  WORKTREE_ROOT,
  'analyzer-internal',
  'findings',
  'card-telemetry.jsonl',
);

export interface CardTelemetryRecord {
  readonly cardId: string;
  readonly repo: string;
  readonly commit: string;
  readonly file: string;
  readonly line: number;
  readonly guideId: string;
  readonly ruleId: string;
  readonly ruleHash: string;
  readonly guideHash: string;
  readonly promptVersion: string;
  readonly timestamp: string;
  readonly runId: string;
  readonly source: 'live';
  readonly phase2?: {
    readonly keep: boolean;
    readonly confidence?: Phase2Confidence;
    readonly reason?: string;
  };
  readonly judge?: {
    readonly runVotes: readonly JudgeVerdict[];
    readonly majorityVerdict: JudgeVerdict;
    readonly rationale?: string;
    readonly facts?: DetectiveFactCheck;
  };
}

function hasTelemetryCoreFields(obj: object): obj is {
  readonly cardId: string;
  readonly repo: string;
  readonly commit: string;
  readonly file: string;
  readonly line: number;
  readonly guideId: string;
  readonly ruleId: string;
  readonly ruleHash: string;
  readonly guideHash: string;
  readonly promptVersion: string;
  readonly timestamp: string;
} {
  return (
    'cardId' in obj &&
    typeof obj.cardId === 'string' &&
    'repo' in obj &&
    typeof obj.repo === 'string' &&
    'commit' in obj &&
    typeof obj.commit === 'string' &&
    'file' in obj &&
    typeof obj.file === 'string' &&
    'line' in obj &&
    typeof obj.line === 'number' &&
    'guideId' in obj &&
    typeof obj.guideId === 'string' &&
    'ruleId' in obj &&
    typeof obj.ruleId === 'string' &&
    'ruleHash' in obj &&
    typeof obj.ruleHash === 'string' &&
    'guideHash' in obj &&
    typeof obj.guideHash === 'string' &&
    'promptVersion' in obj &&
    typeof obj.promptVersion === 'string' &&
    'timestamp' in obj &&
    typeof obj.timestamp === 'string'
  );
}

export function isCardTelemetryRecord(obj: unknown): obj is CardTelemetryRecord {
  if (typeof obj !== 'object' || obj === null || !hasTelemetryCoreFields(obj)) {
    return false;
  }
  return (
    'runId' in obj &&
    typeof obj.runId === 'string' &&
    obj.runId.length > 0 &&
    'source' in obj &&
    obj.source === 'live'
  );
}

function isPreProvenanceTelemetryRecord(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null || !hasTelemetryCoreFields(obj)) {
    return false;
  }
  const validRunId = !('runId' in obj) || obj.runId === undefined || typeof obj.runId === 'string';
  const validSource =
    !('source' in obj) ||
    obj.source === undefined ||
    obj.source === 'live' ||
    obj.source === 'synthetic';
  return validRunId && validSource;
}

export function computeRuleHash(rule: AnalyzerRule): string {
  return createHash('sha256')
    .update(rule.id)
    .update(':')
    .update(JSON.stringify(rule.verifierRubric))
    .digest('hex')
    .slice(0, 12);
}

export function computeTelemetryCacheKey(
  cardId: string,
  ruleHash: string,
  guideHash: string,
  promptVersion: string,
): string {
  return `${cardId}:${ruleHash}:${guideHash}:${promptVersion}`;
}

import { isEnoent } from './progress-log.ts';

/**
 * Loads existing telemetry ledger from disk into a lookup map keyed by (cardId:ruleHash:guideHash:promptVersion).
 */
export async function loadCardTelemetryMap(
  filePath: string = CARD_TELEMETRY_PATH,
): Promise<Map<string, CardTelemetryRecord>> {
  const map = new Map<string, CardTelemetryRecord>();
  let content = '';
  try {
    content = await readFile(filePath, 'utf8');
  } catch (err: unknown) {
    if (isEnoent(err)) {
      return map;
    }
    throw err;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    let record: unknown;
    try {
      record = JSON.parse(trimmed);
    } catch (err: unknown) {
      throw new Error(`Invalid JSON in ${filePath}:${i + 1}: ${String(err)}`);
    }
    if (!isCardTelemetryRecord(record)) {
      if (isPreProvenanceTelemetryRecord(record)) {
        // Ignore historical pre-provenance records lacking runId / source: 'live' (O56, O71)
        continue;
      }
      throw new Error(
        `Record in ${filePath}:${i + 1} does not match CardTelemetryRecord schema: ${trimmed}`,
      );
    }
    const key = computeTelemetryCacheKey(
      record.cardId,
      record.ruleHash,
      record.guideHash,
      record.promptVersion,
    );
    map.set(key, record);
  }

  return map;
}

/**
 * Appends new telemetry records to the on-disk ledger.
 */
export async function appendCardTelemetry(
  records: readonly CardTelemetryRecord[],
  filePath: string = CARD_TELEMETRY_PATH,
): Promise<void> {
  if (records.length === 0) return;

  await mkdir(dirname(filePath), { recursive: true });
  const payload = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await appendFile(filePath, payload, 'utf8');
}
