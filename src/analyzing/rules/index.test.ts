import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { scanAllGuides } from '../../core/guide-validation.ts';
import { normalizeFastTokenGroups } from '../scanners/js-scanner.ts';
import type { AnalyzerRule } from '../schema.ts';
import {
  ALL_RULES,
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_RULES,
  RETIRED,
  RETIRED_GUIDES,
  RETIRED_RULES,
  RULE_MODULES,
  RULE_REGISTRY,
  STATUS,
} from './index.ts';

function isAnalyzerRuleExport(value: unknown): value is AnalyzerRule {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'id' in value &&
    'guideId' in value &&
    'guideHash' in value &&
    'matcher' in value &&
    'verifierRubric' in value
  );
}

describe('rule registry architectural invariants', () => {
  it('enforces that STATUS keys equal the set of all rule IDs exported by rule modules', () => {
    const moduleRuleIds = RULE_MODULES.flat().map((r) => r.id);
    const statusRuleIds = Object.keys(STATUS);

    const moduleRuleIdSet = new Set(moduleRuleIds);
    const statusRuleIdSet = new Set(statusRuleIds);

    assert.strictEqual(
      moduleRuleIdSet.size,
      moduleRuleIds.length,
      'Rule IDs exported across RULE_MODULES must be globally unique',
    );

    const missingInStatus = moduleRuleIds.filter((id) => !statusRuleIdSet.has(id));
    const extraInStatus = statusRuleIds.filter((id) => !moduleRuleIdSet.has(id));

    assert.deepStrictEqual(
      missingInStatus,
      [],
      `Rule IDs exported by rule modules but missing from STATUS: ${missingInStatus.join(', ')}`,
    );
    assert.deepStrictEqual(
      extraInStatus,
      [],
      `Rule IDs in STATUS that do not exist in any rule module: ${extraInStatus.join(', ')}`,
    );

    for (const [ruleId, statusVal] of Object.entries(STATUS)) {
      assert.ok(
        statusVal === 'qualified' || statusVal === 'experimental',
        `Rule "${ruleId}" has unexpected STATUS value "${String(statusVal)}"`,
      );
    }
  });

  it('enforces that every rule module file on disk is registered in RULE_REGISTRY', () => {
    const rulesDir = resolve(import.meta.dirname);
    const untrackedFiles = new Set<string>();
    const gitStatus = execSync('git status --porcelain src/analyzing/rules', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const line of gitStatus.split('\n')) {
      if (line.startsWith('?? ')) {
        const match = line.slice(3).trim().match(/([^/\\]+)\.ts$/);
        if (match && !line.includes('.test.ts')) {
          untrackedFiles.add(match[1]!);
        }
      }
    }

    const filesOnDisk = readdirSync(rulesDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts')
      .map((f) => f.replace(/\.ts$/, ''))
      .filter((f) => !untrackedFiles.has(f));

    const registryGuideIds = new Set(RULE_REGISTRY.map((e) => e.guideId));

    for (const file of filesOnDisk) {
      assert.ok(
        registryGuideIds.has(file),
        `Rule module on disk "${file}.ts" is not registered in RULE_REGISTRY in rules/index.ts`,
      );
    }
  });

  it('enforces that RETIRED_GUIDES and RETIRED_RULES are disjoint, represented in RULE_REGISTRY, and carry non-empty plain-language reasons', () => {
    const rulesDir = resolve(import.meta.dirname);
    const activeByGuide = new Map(
      RULE_REGISTRY.filter((e) => e.lifecycle.status !== 'retired').map((e) => [e.guideId, e]),
    );
    const retiredByGuide = new Map(
      RULE_REGISTRY.filter((e) => e.lifecycle.status === 'retired').map((e) => [e.guideId, e]),
    );

    for (const [guideId, reason] of Object.entries(RETIRED_GUIDES)) {
      assert.ok(
        !(guideId in RETIRED_RULES),
        `RETIRED_GUIDES key "${guideId}" must not also appear in RETIRED_RULES`,
      );
      assert.ok(
        !activeByGuide.has(guideId),
        `RETIRED_GUIDES entry "${guideId}" must not be an active guide in RULE_REGISTRY`,
      );
      assert.ok(
        !existsSync(join(rulesDir, `${guideId}.ts`)),
        `RETIRED_GUIDES module ${guideId}.ts should be deleted from disk`,
      );
      const retiredEntry = retiredByGuide.get(guideId);
      assert.ok(
        retiredEntry &&
          retiredEntry.lifecycle.status === 'retired' &&
          retiredEntry.lifecycle.reason === reason,
        `RETIRED_GUIDES entry "${guideId}" must appear in RULE_REGISTRY with lifecycle.status === 'retired' and matching reason`,
      );
      assert.ok(
        typeof reason === 'string' && reason.trim().length > 0,
        `RETIRED_GUIDES entry ${guideId} must have a non-empty reason`,
      );
      assert.ok(
        !/\bD-\d{3}\b/.test(reason),
        `RETIRED_GUIDES entry ${guideId} reason must be plain-language without internal decision IDs`,
      );
    }

    for (const [ruleId, reason] of Object.entries(RETIRED_RULES)) {
      const guideId = ruleId.split('/')[0]!;
      const activeEntry = activeByGuide.get(guideId);
      assert.ok(
        activeEntry,
        `RETIRED_RULES entry "${ruleId}" must belong to an active guide in RULE_REGISTRY (if the entire guide is retired, move "${guideId}" to RETIRED_GUIDES)`,
      );
      assert.ok(
        !(ruleId in STATUS) &&
          activeEntry.rules.length > 0 &&
          !activeEntry.rules.some((r) => r.id === ruleId),
        `RETIRED_RULES entry "${ruleId}" must be removed from STATUS and "${guideId}.ts" while keeping remaining rules`,
      );
      assert.strictEqual(
        activeEntry.retiredRules?.[ruleId],
        reason,
        `Active guide "${guideId}" in RULE_REGISTRY must expose retiredRules["${ruleId}"] with its retirement reason`,
      );
      assert.ok(
        typeof reason === 'string' && reason.trim().length > 0,
        `RETIRED_RULES entry ${ruleId} must have a non-empty reason`,
      );
      assert.ok(
        !/\bD-\d{3}\b/.test(reason),
        `RETIRED_RULES entry ${ruleId} reason must be plain-language without internal decision IDs`,
      );
    }

    const registryRetiredRules = Object.fromEntries(
      RULE_REGISTRY.flatMap((e) => Object.entries(e.retiredRules ?? {})),
    );
    assert.deepStrictEqual(
      registryRetiredRules,
      RETIRED_RULES,
      'RULE_REGISTRY entry.retiredRules across all entries must equal RETIRED_RULES',
    );
    assert.deepStrictEqual(
      RETIRED,
      { ...RETIRED_GUIDES, ...RETIRED_RULES },
      'RETIRED must equal the union of RETIRED_GUIDES and RETIRED_RULES',
    );
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

  it('enforces lifecycle derived lists consistency', () => {
    const qualifiedEntries = RULE_REGISTRY.filter((e) => e.lifecycle.status === 'qualified');
    assert.deepStrictEqual(QUALIFIED_GUIDE_IDS, qualifiedEntries.map((e) => e.guideId));
    assert.deepStrictEqual(
      QUALIFIED_RULES,
      ALL_RULES.filter((r) => STATUS[r.id] === 'qualified'),
    );

    const activeEntries = RULE_REGISTRY.filter((e) => e.lifecycle.status !== 'retired');
    assert.deepStrictEqual(
      ALL_RULES,
      activeEntries.flatMap((e) => e.rules),
    );
  });

  it('validates rule properties and default-export completeness for all rule modules', async (t) => {
    const rulesDir = resolve(import.meta.dirname);
    const seenRegisteredRuleIds = new Set<string>();
    for (const entry of RULE_REGISTRY) {
      if (entry.lifecycle.status === 'retired') {
        continue;
      }
      const filePath = join(rulesDir, `${entry.guideId}.ts`);
      const modUrl = pathToFileURL(filePath).href;
      const mod: Record<string, unknown> = await import(modUrl);
      assert.ok(
        Array.isArray(mod.default) && mod.default.length > 0,
        `Rule module "${entry.guideId}.ts" must default-export a non-empty rules array`,
      );
      assert.deepStrictEqual(
        mod.default,
        entry.rules,
        `Default export of "${entry.guideId}.ts" must equal RULE_REGISTRY entry.rules`,
      );

      const exportedRules = [
        ...new Set([
          ...(mod.default as unknown[]).filter(isAnalyzerRuleExport),
          ...Object.values(mod).filter(isAnalyzerRuleExport),
          ...Object.entries(mod)
            .filter(([k, v]) => k !== 'default' && Array.isArray(v))
            .flatMap(([, v]) => (v as unknown[]).filter(isAnalyzerRuleExport)),
        ]),
      ];
      assert.ok(
        exportedRules.length > 0,
        `Rule module "${entry.guideId}.ts" must export at least one AnalyzerRule`,
      );
      for (const exportedRule of exportedRules) {
        assert.ok(
          entry.rules.includes(exportedRule),
          `Exported rule "${exportedRule.id}" in "${entry.guideId}.ts" is missing from its default export`,
        );
      }

      const sourceText = readFileSync(filePath, 'utf8');
      const definedRuleCount = (sourceText.match(/\bverifierRubric\s*:/g) ?? []).length;
      assert.strictEqual(
        entry.rules.length,
        definedRuleCount,
        `Module "${entry.guideId}.ts" defines ${definedRuleCount} AnalyzerRule object(s) (by verifierRubric:) but default-exports ${entry.rules.length}`,
      );

      for (const rule of entry.rules) {
        assert.ok(!seenRegisteredRuleIds.has(rule.id), `duplicate rule id: ${rule.id}`);
        seenRegisteredRuleIds.add(rule.id);
      }

      for (const rule of entry.rules) {
        await t.test(`rule ${rule.id} (${rule.guideId}) has valid structure`, () => {
          assert.ok(rule.id, 'rule has id');
          assert.strictEqual(rule.guideId, entry.guideId, 'rule.guideId matches entry.guideId');
          assert.match(rule.guideHash, /^[0-9a-f]{12}$/, 'guideHash is 12 lowercase hex chars');
          assert.ok(rule.summary, 'rule has summary');
          assert.ok(rule.matcher, 'rule has matcher');
          assert.ok(rule.verifierRubric.keepWhen.length > 0, 'has keepWhen');
          assert.ok(rule.verifierRubric.dropWhen.length > 0, 'has dropWhen');
        });
      }
    }
  });

  it('enforces structural FastTokenSpec / packages invariant on every rule in ALL_RULES', () => {
    for (const rule of ALL_RULES) {
      if (rule.matcher.kind === 'dependency') {
        assert.ok(
          Array.isArray(rule.matcher.packages) && rule.matcher.packages.length > 0,
          `Dependency rule "${rule.id}" must declare a non-empty matcher.packages array`,
        );
        for (const pkg of rule.matcher.packages) {
          assert.ok(
            typeof pkg === 'string' && pkg.trim().length > 0,
            `Dependency rule "${rule.id}" contains an empty package name`,
          );
        }
        continue;
      }

      const groups = normalizeFastTokenGroups(rule.matcher.fastTokens);
      assert.ok(
        groups.length > 0,
        `Rule "${rule.id}" (${rule.matcher.kind}) must declare non-empty matcher.fastTokens`,
      );
      for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const group = groups[gIdx];
        assert.ok(
          group && group.length > 0,
          `Rule "${rule.id}" fastTokens group[${gIdx}] must not be empty`,
        );
        for (const token of group) {
          assert.ok(
            typeof token === 'string' && token.length > 0,
            `Rule "${rule.id}" fastTokens group[${gIdx}] contains an empty token`,
          );
        }
      }
    }
  });

  it('enforces anti-sponge selectivity gate on fastTokens across ALL_RULES', () => {
    const bannedUltraGenericSingleGroupTokens = new Set([
      'scroll',
      'click',
      'keydown',
      'blur',
      'change',
      'mousedown',
      'setAttribute',
      'addEventListener',
      'querySelector',
      'classList',
      'localStorage',
      'IntersectionObserver',
      'ResizeObserver',
      'getBoundingClientRect',
      'setTimeout',
      'Promise',
      'Math.round',
      'Math.floor',
      'transform',
      'overflow',
      ':invalid',
      '@media',
      'div',
      'span',
      'input',
      'button',
    ]);

    const rulesDir = resolve(import.meta.dirname);
    const ruleTestFiles = readdirSync(rulesDir)
      .filter((f) => f.endsWith('.test.ts') && f !== 'index.test.ts')
      .map((f) => ({
        guideId: f.replace(/\.test\.ts$/, ''),
        content: readFileSync(join(rulesDir, f), 'utf8'),
      }));

    assert.ok(
      ruleTestFiles.length >= 50,
      `Expected at least 50 rule test files for selectivity check, found ${ruleTestFiles.length}`,
    );

    for (const rule of ALL_RULES) {
      if (rule.matcher.kind === 'dependency') {
        continue;
      }

      const groups = normalizeFastTokenGroups(rule.matcher.fastTokens);
      if (groups.length === 1) {
        const singleGroup = groups[0] ?? [];
        const allBanned = singleGroup.every((tok) =>
          bannedUltraGenericSingleGroupTokens.has(tok.trim()),
        );
        assert.strictEqual(
          allBanned,
          false,
          `Rule "${rule.id}" has a single-group fastTokens consisting solely of banned ultra-generic tokens: ${JSON.stringify(singleGroup)}`,
        );
      }

      const unrelatedTestFiles = ruleTestFiles.filter((tf) => tf.guideId !== rule.guideId);
      let matchedUnrelated = 0;
      for (const tf of unrelatedTestFiles) {
        const matchesAllGroups = groups.every((group) =>
          group.some((tok) => tf.content.includes(tok)),
        );
        if (matchesAllGroups) {
          matchedUnrelated++;
        }
      }

      const matchRatio = matchedUnrelated / unrelatedTestFiles.length;
      assert.ok(
        matchRatio <= 0.15,
        `Rule "${rule.id}" fastTokens ${JSON.stringify(rule.matcher.fastTokens)} is a sponge matching ${(matchRatio * 100).toFixed(1)}% (${matchedUnrelated}/${unrelatedTestFiles.length}) of unrelated rule test files (max 15%)`,
      );
    }
  });
});
