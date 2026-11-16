import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import matter from '@11ty/gray-matter';
import { ALL_RULES } from './index.ts';
import { scanAllGuides } from '../../core/guide-validation.ts';
import { buildHeadingMap } from '../../core/headings.ts';
import { replaceMacros } from '../../core/macros.ts';
import type { AnalyzerRule } from '../schema.ts';

function validateRuleSections(
  rules: readonly AnalyzerRule[],
  guideBodiesById: ReadonlyMap<string, string>,
): string[] {
  const errors: string[] = [];
  const headingCache = new Map<string, ReturnType<typeof buildHeadingMap>>();

  for (const rule of rules) {
    if (rule.section === undefined) continue;
    if (!rule.section) {
      errors.push(`Rule "${rule.id}" has an empty section field`);
      continue;
    }

    const body = guideBodiesById.get(rule.guideId);
    if (body === undefined) {
      errors.push(`Rule "${rule.id}" references unknown guideId "${rule.guideId}"`);
      continue;
    }

    let headings = headingCache.get(rule.guideId);
    if (!headings) {
      headings = buildHeadingMap(body);
      headingCache.set(rule.guideId, headings);
    }

    if (!headings.headingIds.has(rule.section)) {
      errors.push(
        `Rule "${rule.id}" section "${rule.section}" does not resolve to a canonical heading ID in guide "${rule.guideId}"`,
      );
    }
  }

  return errors;
}

describe('analyzer rule sections', () => {
  const guidePaths = new Map(
    scanAllGuides()
      .filter((inv) => inv.hasGuide)
      .map((inv) => [inv.name, path.join(inv.dir, 'guide.md')]),
  );
  const guideBodies = new Map<string, string>();
  for (const rule of ALL_RULES) {
    if (rule.section === undefined || guideBodies.has(rule.guideId)) continue;
    const guidePath = guidePaths.get(rule.guideId);
    if (!guidePath) continue;
    const raw = fs.readFileSync(guidePath, 'utf8');
    const body = replaceMacros(matter(raw).content, guidePath, { target: 'skills-cli' });
    guideBodies.set(rule.guideId, body);
  }

  it('resolves every non-undefined rule section across ALL_RULES', () => {
    assert.deepStrictEqual(validateRuleSections(ALL_RULES, guideBodies), []);
  });

  it('sets section on all js/* rules', () => {
    const jsRules = ALL_RULES.filter((rule) => rule.guideId === 'js');
    assert.equal(jsRules.length, 11);
    for (const rule of jsRules) {
      assert.ok(rule.section, `Rule "${rule.id}" must specify a section`);
    }
  });

  for (const rule of ALL_RULES) {
    if (!rule.section) continue;
    it(`resolves ${rule.id} section "${rule.section}" in ${rule.guideId}/guide.md`, () => {
      assert.deepStrictEqual(validateRuleSections([rule], guideBodies), []);
    });
  }

  it('rejects a typo or missing heading ID', () => {
    const template = ALL_RULES.find((rule) => rule.section !== undefined);
    assert.ok(template);
    const badRule: AnalyzerRule = { ...template, section: 'does-not-exist-xyz' };
    const errors = validateRuleSections([badRule], guideBodies);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /does not resolve to a canonical heading ID/);
  });
});
