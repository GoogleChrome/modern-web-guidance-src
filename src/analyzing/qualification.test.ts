import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isGuideQualified,
  QUALIFIED_GUIDE_IDS,
  SUSPENDED_QUALIFIED_GUIDE_IDS,
} from './qualification.ts';
import { RULE_REGISTRY } from './rules/index.ts';

describe('qualification shipping lists invariant over RULE_REGISTRY', () => {
  it('enforces isGuideQualified and QUALIFIED_GUIDE_IDS match status === "qualified"', () => {
    assert.ok(RULE_REGISTRY.length > 0, 'RULE_REGISTRY must not be empty');
    for (const entry of RULE_REGISTRY) {
      const isQualified = entry.lifecycle.status === 'qualified';
      assert.strictEqual(
        isGuideQualified(entry.guideId),
        isQualified,
        `isGuideQualified("${entry.guideId}") must be ${isQualified}`,
      );
      assert.strictEqual(
        QUALIFIED_GUIDE_IDS.includes(entry.guideId),
        isQualified,
        `QUALIFIED_GUIDE_IDS.includes("${entry.guideId}") must be ${isQualified}`,
      );
    }
  });

  it('enforces SUSPENDED_QUALIFIED_GUIDE_IDS matches status === "suspended"', () => {
    for (const entry of RULE_REGISTRY) {
      const isSuspended = entry.lifecycle.status === 'suspended';
      assert.strictEqual(
        SUSPENDED_QUALIFIED_GUIDE_IDS.includes(entry.guideId),
        isSuspended,
        `SUSPENDED_QUALIFIED_GUIDE_IDS.includes("${entry.guideId}") must be ${isSuspended}`,
      );
      if (isSuspended) {
        assert.strictEqual(
          isGuideQualified(entry.guideId),
          false,
          `Suspended guide "${entry.guideId}" must NOT be isGuideQualified`,
        );
      }
    }
  });

  it('enforces retired entries are never qualified or suspended', () => {
    const retiredEntries = RULE_REGISTRY.filter((e) => e.lifecycle.status === 'retired');
    assert.ok(retiredEntries.length > 0, 'Must have registered retired entries');
    for (const entry of retiredEntries) {
      assert.strictEqual(isGuideQualified(entry.guideId), false);
      assert.strictEqual(QUALIFIED_GUIDE_IDS.includes(entry.guideId), false);
      assert.strictEqual(SUSPENDED_QUALIFIED_GUIDE_IDS.includes(entry.guideId), false);
    }
  });
});
