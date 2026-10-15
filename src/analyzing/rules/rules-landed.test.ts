import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_RULES } from './index.ts';
import { scanAllGuides, getGuideStatus, ProjectStatus } from '../../core/guide-validation.ts';

describe('168-landed-guide invariant for analyzer rules', () => {
  it('asserts that every rule in ALL_RULES belongs to the 168 landed feature guides', async (t) => {
    const allGuides = await scanAllGuides();
    const landedFeatureGuides = allGuides.filter(
      (g) =>
        !g.isDisciplineGuide &&
        !g.isStub &&
        (getGuideStatus(g) === null || getGuideStatus(g) === ProjectStatus.NeedsEvals),
    );

    assert.strictEqual(
      landedFeatureGuides.length,
      168,
      'Corpus must have exactly 168 landed feature guides',
    );

    const landedGuideIds = new Set(landedFeatureGuides.map((g) => g.name));

    const ruleGuideIds = new Set(ALL_RULES.map((r) => r.guideId));
    assert.strictEqual(ruleGuideIds.size, 29, 'ALL_RULES covers exactly 29 landed feature guides');

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
