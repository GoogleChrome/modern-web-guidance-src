import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { DetectiveFactCheck, JudgeResult, JudgeVerdict } from './judge.ts';
import { WORKTREE_ROOT } from './paths.ts';
import type { Phase2Confidence, Phase2Verdict } from './phase2.ts';
import type { AnalyzerFinding, AnalyzerRule } from './schema.ts';

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

export function computeRuleHash(rule: AnalyzerRule): string {
  return createHash('sha256')
    .update(rule.id)
    .update(':')
    .update(JSON.stringify(rule.phase2Rubric))
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
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = JSON.parse(trimmed) as CardTelemetryRecord;
      const key = computeTelemetryCacheKey(
        record.cardId,
        record.ruleHash,
        record.guideHash,
        record.promptVersion,
      );
      map.set(key, record);
    } catch {
      // Skip corrupted lines
    }
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
