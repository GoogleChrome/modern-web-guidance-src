import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  appendCardTelemetry,
  computeRuleHash,
  computeTelemetryCacheKey,
  loadCardTelemetryMap,
  type CardTelemetryRecord,
} from './telemetry.ts';

describe('telemetry ledger (P2)', () => {
  it('computes deterministic rule hashes and cache keys', () => {
    const ruleMock = {
      id: 'test-rule',
      guideId: 'test-guide',
      guideHash: '1234567890ab',
      summary: 'Test summary',
      verifierRubric: {
        keepWhen: ['a', 'b'],
        dropWhen: ['c'],
      },
      matcher: { kind: 'js' as const, fastTokens: [], matchFile: () => [] },
    };

    const hash1 = computeRuleHash(ruleMock);
    const hash2 = computeRuleHash(ruleMock);
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 12);

    const key = computeTelemetryCacheKey('card-001', hash1, 'guide-hash-1', 'v1');
    assert.equal(key, `card-001:${hash1}:guide-hash-1:v1`);
  });

  it('loads, appends, and reads back telemetry records idempotently', async () => {
    const testDir = await mkdtemp(join(tmpdir(), 'analyzer-telemetry-test-'));
    const testFile = join(testDir, 'telemetry.jsonl');

    try {
      // 1. Initial load on non-existent file returns empty map
      const initialMap = await loadCardTelemetryMap(testFile);
      assert.equal(initialMap.size, 0);

      // 2. Append records
      const record1: CardTelemetryRecord = {
        runId: 'test-run-1',
        source: 'live',
        cardId: 'card-1',
        repo: 'repo-1',
        commit: 'commit-1',
        file: 'src/index.js',
        line: 10,
        guideId: 'guide-1',
        ruleId: 'rule-1',
        ruleHash: 'rule-hash-1',
        guideHash: 'guide-hash-1',
        promptVersion: 'v1',
        timestamp: '2026-10-15T00:00:00Z',
        phase2: {
          keep: true,
          confidence: 'high',
          reason: 'Valid finding',
        },
      };

      await appendCardTelemetry([record1], testFile);

      // 3. Load back
      const loadedMap = await loadCardTelemetryMap(testFile);
      assert.equal(loadedMap.size, 1);
      const key1 = computeTelemetryCacheKey('card-1', 'rule-hash-1', 'guide-hash-1', 'v1');
      assert.ok(loadedMap.has(key1));
      assert.equal(loadedMap.get(key1)?.phase2?.keep, true);

      // Verify file contents
      const raw = await readFile(testFile, 'utf8');
      assert.match(raw, /"cardId":"card-1"/);

      // 4. Pre-provenance records lacking runId/source are skipped without poisoning cache, while malformed schema throws
      const preProvenanceLine = JSON.stringify({
        cardId: 'legacy-card',
        repo: 'repo-1',
        commit: 'head',
        file: 'src/index.js',
        line: 5,
        guideId: 'guide-1',
        ruleId: 'rule-1',
        ruleHash: 'rule-hash-1',
        guideHash: 'guide-hash-1',
        promptVersion: 'v1',
        timestamp: '2026-10-15T00:00:00Z',
      });
      await writeFile(testFile, `${preProvenanceLine}\n${raw}`, 'utf8');
      const reloadedMap = await loadCardTelemetryMap(testFile);
      assert.equal(reloadedMap.size, 1);

      await writeFile(testFile, `{"cardId":123}\n`, 'utf8');
      await assert.rejects(() => loadCardTelemetryMap(testFile), /does not match CardTelemetryRecord schema/);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
