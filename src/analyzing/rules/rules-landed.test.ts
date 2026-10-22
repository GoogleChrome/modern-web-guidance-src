import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_RULES } from './index.ts';
import { scanAllGuides } from '../../core/guide-validation.ts';

describe('175-landed-guide invariant for analyzer rules', () => {
  it('asserts that every rule in ALL_RULES belongs to the 175 landed feature guides', async (t) => {
    const allGuides = scanAllGuides();
    const landedFeatureGuides = allGuides.filter(
      (g) => !g.isDisciplineGuide && g.isPublished,
    );

    assert.strictEqual(
      landedFeatureGuides.length,
      175,
      'Corpus must have exactly 175 landed feature guides',
    );

    const landedGuideIds = new Set(landedFeatureGuides.map((g) => g.name));

    const ruleGuideIds = new Set(ALL_RULES.map((r) => r.guideId));
    assert.strictEqual(ruleGuideIds.size, 37, 'ALL_RULES covers exactly 37 landed feature guides');

    for (const rule of ALL_RULES) {
      await t.test(`rule ${rule.id} (${rule.guideId}) is a landed feature guide`, () => {
        assert.ok(
          landedGuideIds.has(rule.guideId),
          `Rule ${rule.id} has guideId ${rule.guideId} which is not a landed feature guide!`,
        );
      });
    }
  });
});
