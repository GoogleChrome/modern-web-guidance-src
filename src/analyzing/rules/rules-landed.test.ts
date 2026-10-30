import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QUALIFIED_RULES } from './index.ts';
import { scanAllGuides } from '../../core/guide-validation.ts';

describe('172-landed-guide invariant for analyzer rules', () => {
  it('asserts that every rule in QUALIFIED_RULES belongs to the 172 landed feature guides', async (t) => {
    const allGuides = scanAllGuides();
    const landedFeatureGuides = allGuides.filter(
      (g) => !g.isDisciplineGuide && g.isPublished,
    );

    assert.strictEqual(
      landedFeatureGuides.length,
      172,
      'Corpus must have exactly 172 landed feature guides',
    );

    const landedGuideIds = new Set(landedFeatureGuides.map((g) => g.name));

    const ruleGuideIds = new Set(QUALIFIED_RULES.map((r) => r.guideId));
    assert.ok(ruleGuideIds.size > 0, 'QUALIFIED_RULES must cover active landed feature guides');

    for (const rule of QUALIFIED_RULES) {
      await t.test(`rule ${rule.id} (${rule.guideId}) is a landed feature guide`, () => {
        assert.ok(
          landedGuideIds.has(rule.guideId),
          `Rule ${rule.id} has guideId ${rule.guideId} which is not a landed feature guide!`,
        );
      });
    }
  });
});
