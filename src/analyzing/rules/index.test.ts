import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { scanAllGuides } from '../../core/guide-validation.ts';
import { getSeededSensitivityTestCases } from '../eval/update-eval.ts';
import {
  ALL_RULES,
  POST_SELECTION_TUNED_GUIDE_IDS,
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_RULES,
  RULE_REGISTRY,
  SUSPENDED_QUALIFIED_GUIDE_IDS,
} from './index.ts';

const PENDING_HELD_OUT_CHECK = new Set([
  'slider',
  'physics-based-easing',
]);

describe('rule registry architectural invariants', () => {
  it('enforces that every rule module file on disk is registered in RULE_REGISTRY', () => {
    const rulesDir = resolve(import.meta.dirname);
    const filesOnDisk = readdirSync(rulesDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts')
      .map((f) => f.replace(/\.ts$/, ''));

    const registryGuideIds = new Set(RULE_REGISTRY.map((e) => e.guideId));

    for (const file of filesOnDisk) {
      if (PENDING_HELD_OUT_CHECK.has(file)) {
        continue;
      }
      assert.ok(
        registryGuideIds.has(file),
        `Rule module on disk "${file}.ts" is not registered in RULE_REGISTRY in rules/index.ts`,
      );
    }
  });

  it('enforces that every non-retired entry has its module on disk and non-empty rules', () => {
    const rulesDir = resolve(import.meta.dirname);
    for (const entry of RULE_REGISTRY) {
      if (entry.lifecycle.status === 'retired') {
        assert.strictEqual(
          entry.rules.length,
          0,
          `Retired entry ${entry.guideId} must have empty rules array`,
        );
        assert.ok(
          !existsSync(join(rulesDir, `${entry.guideId}.ts`)),
          `Retired module ${entry.guideId}.ts should be deleted from disk`,
        );
      } else {
        assert.ok(
          existsSync(join(rulesDir, `${entry.guideId}.ts`)),
          `Non-retired entry ${entry.guideId} must have a corresponding module on disk`,
        );
        assert.ok(
          entry.rules.length > 0,
          `Non-retired entry ${entry.guideId} must export at least 1 rule`,
        );
      }
    }
  });

  it('enforces that every non-retired guide exists in the catalog with a non-stub guide.md', () => {
    const allGuides = scanAllGuides();
    const guideMap = new Map(allGuides.map((g) => [g.name, g]));

    for (const entry of RULE_REGISTRY) {
      if (entry.lifecycle.status === 'retired') {
        continue;
      }
      const guide = guideMap.get(entry.guideId);
      assert.ok(
        guide,
        `Active rule entry "${entry.guideId}" does not exist in catalog!`,
      );
      assert.ok(
        guide.isPublished,
        `Active rule entry "${entry.guideId}" must be a published catalog guide`,
      );
      assert.ok(
        !guide.isStub,
        `Guide "${entry.guideId}" must not be a stub`,
      );
    }
  });

  it('enforces that every qualified guide has seeded Update Eval fixtures', () => {
    const fixtures = getSeededSensitivityTestCases();
    const fixtureGuideIds = new Set(fixtures.map((f) => f.guideId));

    for (const qid of QUALIFIED_GUIDE_IDS) {
      assert.ok(
        fixtureGuideIds.has(qid),
        `Qualified default shipping guide "${qid}" must have seeded Update Eval test fixtures`,
      );
    }
  });

  it('enforces lifecycle derived lists consistency and post-selection tuning', () => {
    const qualifiedEntries = RULE_REGISTRY.filter((e) => e.lifecycle.status === 'qualified');
    assert.deepStrictEqual(QUALIFIED_GUIDE_IDS, qualifiedEntries.map((e) => e.guideId));
    assert.deepStrictEqual(
      QUALIFIED_RULES,
      qualifiedEntries.flatMap((e) => e.rules),
    );

    const suspendedEntries = RULE_REGISTRY.filter((e) => e.lifecycle.status === 'suspended');
    assert.deepStrictEqual(SUSPENDED_QUALIFIED_GUIDE_IDS, suspendedEntries.map((e) => e.guideId));

    const tunedEntries = RULE_REGISTRY.filter((e) => Boolean(e.postSelectionTuned));
    assert.deepStrictEqual(POST_SELECTION_TUNED_GUIDE_IDS, tunedEntries.map((e) => e.guideId));
    assert.ok(
      POST_SELECTION_TUNED_GUIDE_IDS.includes('animate-element-entry-exit'),
      'animate-element-entry-exit must be marked postSelectionTuned',
    );

    const activeEntries = RULE_REGISTRY.filter((e) => e.lifecycle.status !== 'retired');
    assert.deepStrictEqual(
      ALL_RULES,
      activeEntries.flatMap((e) => e.rules),
    );
  });

  it('validates rule properties for all rules in ALL_RULES', async (t) => {
    for (const rule of ALL_RULES) {
      await t.test(`rule ${rule.id} (${rule.guideId}) has valid structure`, () => {
        assert.ok(rule.id, 'rule has id');
        assert.ok(rule.guideId, 'rule has guideId');
        assert.ok(rule.guideHash, 'rule has guideHash');
        assert.strictEqual(rule.guideHash.length, 12, 'guideHash is 12 chars');
        assert.ok(rule.summary, 'rule has summary');
        assert.ok(rule.matcher, 'rule has matcher');
        assert.ok(rule.verifierRubric.keepWhen.length > 0, 'has keepWhen');
        assert.ok(rule.verifierRubric.dropWhen.length > 0, 'has dropWhen');
      });
    }
  });
});
