import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QUALIFIED_RULES } from './index.ts';
import { scanAllGuides, type GuideInventory } from '../../core/guide-validation.ts';

export type GuideTargetInfo = Pick<
  GuideInventory,
  'name' | 'isDisciplineGuide' | 'isPublished' | 'isStub'
>;

export function getLandedFeatureGuides<T extends Pick<GuideInventory, 'isDisciplineGuide' | 'isPublished'>>(
  allGuides: readonly T[],
): T[] {
  return allGuides.filter((g) => !g.isDisciplineGuide && g.isPublished);
}

export function getValidRuleTargetGuideIds(
  allGuides: readonly GuideTargetInfo[],
): Set<string> {
  return new Set(
    allGuides
      .filter((g) => g.isPublished && !g.isStub)
      .map((g) => g.name),
  );
}

describe('landed-guide invariant for analyzer rules', () => {
  it('asserts that every rule in QUALIFIED_RULES belongs to a landed feature guide or published discipline guide', async (t) => {
    const allGuides = scanAllGuides();
    const landedFeatureGuides = getLandedFeatureGuides(allGuides);

    assert.ok(
      landedFeatureGuides.length > 0,
      'Corpus must have landed feature guides',
    );
    assert.ok(
      landedFeatureGuides.every((g) => !g.isDisciplineGuide),
      'Discipline guides must not be included in the landed feature-guide denominator',
    );

    const validTargetGuideIds = getValidRuleTargetGuideIds(allGuides);

    const ruleGuideIds = new Set(QUALIFIED_RULES.map((r) => r.guideId));
    assert.ok(ruleGuideIds.size > 0, 'QUALIFIED_RULES must cover active landed guides');

    for (const rule of QUALIFIED_RULES) {
      await t.test(`rule ${rule.id} (${rule.guideId}) is a valid rule target guide`, () => {
        assert.ok(
          validTargetGuideIds.has(rule.guideId),
          `Rule ${rule.id} has guideId ${rule.guideId} which is not a landed feature guide or published discipline guide!`,
        );
      });
    }
  });

  it('accepts published discipline guides such as js as rule targets without counting them in the feature-guide denominator', () => {
    const corpusGuides = scanAllGuides();
    const syntheticCorpus: readonly GuideTargetInfo[] = [
      ...corpusGuides,
      {
        name: 'js',
        isDisciplineGuide: true,
        isPublished: true,
        isStub: false,
      },
      {
        name: 'draft-discipline',
        isDisciplineGuide: true,
        isPublished: false,
        isStub: true,
      },
    ];

    const featureDenominator = getLandedFeatureGuides(syntheticCorpus);
    const validTargets = getValidRuleTargetGuideIds(syntheticCorpus);

    assert.ok(
      validTargets.has('js'),
      'Published discipline guide "js" must be accepted as a rule target',
    );
    assert.strictEqual(
      validTargets.has('draft-discipline'),
      false,
      'Stub discipline guide must not be accepted as a rule target',
    );
    assert.strictEqual(
      featureDenominator.some((g) => g.name === 'js'),
      false,
      'Discipline guide "js" must not be counted in the feature-guide denominator',
    );
    assert.strictEqual(
      featureDenominator.length,
      getLandedFeatureGuides(corpusGuides).length,
      'Feature-guide denominator must remain unchanged when discipline guides are added',
    );
  });
});
