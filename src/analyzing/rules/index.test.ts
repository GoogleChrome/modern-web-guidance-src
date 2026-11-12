import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { scanAllGuides } from '../../core/guide-validation.ts';
import { scanFiles } from '../scanners/index.ts';
import {
  CSS_RULE_EXTENSIONS,
  DOM_RULE_EXTENSIONS,
  JS_RULE_EXTENSIONS,
} from '../scanners/file-filter.ts';
import { matchesFastTokens, normalizeFastTokenGroups } from '../scanners/js-scanner.ts';
import type { AnalyzerRule } from '../schema.ts';
import {
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_RULES,
  RULE_MODULES,
} from './index.ts';

export function isAnalyzerRuleExport(value: unknown): value is AnalyzerRule {
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

export interface InspectedRuleModule {
  readonly moduleFiles: readonly string[];
  readonly defaultRules: readonly unknown[];
  readonly exportedRules: readonly AnalyzerRule[];
  readonly definedRuleCount: number;
}

export async function inspectRuleModuleFiles(
  filePath: string,
): Promise<InspectedRuleModule> {
  const mod: Record<string, unknown> = await import(pathToFileURL(filePath).href);
  assert.ok(
    Array.isArray(mod.default),
    `Rule module "${filePath}" must default-export an array of rules`,
  );

  const moduleFiles: string[] = [filePath];
  const subDirPath = filePath.replace(/\.ts$/, '');
  if (existsSync(subDirPath) && statSync(subDirPath).isDirectory()) {
    const subFiles = readdirSync(subDirPath)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .sort();
    for (const subFile of subFiles) {
      moduleFiles.push(join(subDirPath, subFile));
    }
  }

  const exportedRuleSet = new Set<AnalyzerRule>();
  let definedRuleCount = 0;

  for (const candidateFile of moduleFiles) {
    const candidateMod: Record<string, unknown> =
      candidateFile === filePath
        ? mod
        : await import(pathToFileURL(candidateFile).href);

    if (Array.isArray(candidateMod.default)) {
      for (const item of candidateMod.default) {
        if (isAnalyzerRuleExport(item)) {
          exportedRuleSet.add(item);
        }
      }
    }
    for (const value of Object.values(candidateMod)) {
      if (isAnalyzerRuleExport(value)) {
        exportedRuleSet.add(value);
      }
    }
    for (const [key, value] of Object.entries(candidateMod)) {
      if (key !== 'default' && Array.isArray(value)) {
        for (const item of value) {
          if (isAnalyzerRuleExport(item)) {
            exportedRuleSet.add(item);
          }
        }
      }
    }

    const sourceText = readFileSync(candidateFile, 'utf8');
    definedRuleCount += (sourceText.match(/\bverifierRubric\s*:/g) ?? []).length;
  }

  return {
    moduleFiles,
    defaultRules: mod.default,
    exportedRules: [...exportedRuleSet],
    definedRuleCount,
  };
}

export function assertValidFastTokenSpecs(rules: readonly AnalyzerRule[]): void {
  for (const rule of rules) {
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
          typeof token === 'string' && token.trim().length >= 2,
          `Rule "${rule.id}" fastTokens group[${gIdx}] contains a token shorter than 2 chars: ${JSON.stringify(token)}`,
        );
        assert.ok(
          !token.includes('\0') && !token.includes('\x08'),
          `Rule "${rule.id}" fastTokens group[${gIdx}] contains NUL or backspace control character: ${JSON.stringify(token)}`,
        );
      }
    }
  }
}

export function assertAntiSpongeSelectivity(rules: readonly AnalyzerRule[]): void {
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

  const syntheticFixtureCorpus: readonly { readonly name: string; readonly content: string }[] = [
    {
      name: 'api-client.ts',
      content: `
        export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
          const response = await fetch(url, { ...init, headers: { Accept: 'application/json' } });
          if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
          return (await response.json()) as T;
        }
      `,
    },
    {
      name: 'state-store.ts',
      content: `
        export class Store<S> {
          private state: S;
          private listeners = new Set<(state: S) => void>();
          constructor(initial: S) { this.state = initial; }
          getState(): S { return this.state; }
          setState(next: Partial<S>): void {
            this.state = { ...this.state, ...next };
            for (const fn of this.listeners) fn(this.state);
          }
        }
      `,
    },
    {
      name: 'dom-events.js',
      content: `
        const button = document.querySelector('.submit-btn');
        button?.addEventListener('click', (event) => {
          event.preventDefault();
          button.classList.toggle('is-loading');
          button.setAttribute('aria-busy', 'true');
        });
      `,
    },
    {
      name: 'scroll-logger.js',
      content: `
        window.addEventListener('scroll', () => {
          console.debug('User scrolled page');
        });
      `,
    },
    {
      name: 'resize-tracker.ts',
      content: `
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            console.log('Box resized', entry.target);
          }
        });
        const el = document.querySelector('#main');
        if (el) ro.observe(el);
      `,
    },
    {
      name: 'intersection-logger.ts',
      content: `
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => console.log(e.time));
        });
        document.querySelectorAll('.tracked').forEach((n) => io.observe(n));
      `,
    },
    {
      name: 'storage-prefs.ts',
      content: `
        export function saveDraft(key: string, text: string): void {
          localStorage.setItem(key, JSON.stringify({ text, updatedAt: Date.now() }));
        }
        export function readDraft(key: string): string | null {
          return localStorage.getItem(key);
        }
      `,
    },
    {
      name: 'math-utils.ts',
      content: `
        export function clampRatio(val: number, min: number, max: number): number {
          return Math.min(max, Math.max(min, Math.round(val * 100) / 100));
        }
        export function floorBucket(val: number, step: number): number {
          return Math.floor(val / step) * step;
        }
      `,
    },
    {
      name: 'keyboard-shortcut.js',
      content: `
        document.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            document.querySelector('#search-input')?.focus();
          }
        });
      `,
    },
    {
      name: 'form-blur.js',
      content: `
        const field = document.querySelector('#username');
        field?.addEventListener('blur', () => {
          console.log('Field blurred');
        });
        field?.addEventListener('change', () => {
          console.log('Field changed');
        });
      `,
    },
    {
      name: 'ProfileBio.tsx',
      content: `
        import React from 'react';
        const ProfileBio = ({ name, bio }: { name: string; bio: string }) => (
          <section className="profile-box">
            <h2>{name}</h2>
            <p>{bio}</p>
            <button type="button" onClick={() => alert(name)}>Follow</button>
          </section>
        );
        export default ProfileBio;
      `,
    },
    {
      name: 'TodoList.vue',
      content: `
        <template>
          <div class="todo-container">
            <ul>
              <li v-for="item in items" :key="item.id">{{ item.label }}</li>
            </ul>
          </div>
        </template>
        <script setup lang="ts">
        const items = [{ id: 1, label: 'Write unit tests' }];
        </script>
      `,
    },
    {
      name: 'Counter.svelte',
      content: `
        <script>
          let count = 0;
          function increment() { count += 1; }
        </script>
        <button on:click={increment}>Clicks: {count}</button>
      `,
    },
    {
      name: 'layout.css',
      content: `
        .container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          overflow: hidden;
        }
        @media (min-width: 768px) {
          .container { padding: 2rem; }
        }
      `,
    },
    {
      name: 'buttons.css',
      content: `
        .btn {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          transform: none;
        }
        .btn:invalid {
          outline: 2px solid red;
        }
      `,
    },
    {
      name: 'typography.css',
      content: `
        body {
          font-family: system-ui, sans-serif;
          line-height: 1.6;
          color: #1f2937;
        }
        .caption {
          font-size: 0.875rem;
          text-decoration: underline;
        }
      `,
    },
    {
      name: 'index.html',
      content: `
        <!doctype html>
        <html lang="en">
          <head><meta charset="utf-8"><title>Dashboard</title></head>
          <body>
            <header><nav><a href="/home">Home</a></nav></header>
            <main><h1>Welcome</h1><p>Overview metrics</p></main>
          </body>
        </html>
      `,
    },
    {
      name: 'contact-form.html',
      content: `
        <form action="/contact" method="post">
          <label for="fullname">Name</label>
          <input id="fullname" name="fullname" type="text" required />
          <label for="message">Message</label>
          <textarea id="message" name="message"></textarea>
          <button type="submit">Send</button>
        </form>
      `,
    },
    {
      name: 'article.html',
      content: `
        <article class="post-entry">
          <header><h2>Release Notes</h2></header>
          <p>This update improves rendering speed and reduces bundle size.</p>
          <footer><span>Published today</span></footer>
        </article>
      `,
    },
    {
      name: 'async-timer.ts',
      content: `
        export function delay(ms: number): Promise<void> {
          return new Promise((resolve) => {
            setTimeout(() => resolve(), ms);
          });
        }
      `,
    },
  ];

  for (const rule of rules) {
    if (rule.matcher.kind === 'dependency') {
      continue;
    }

    const fastTokens = rule.matcher.fastTokens;
    const groups = normalizeFastTokenGroups(fastTokens);
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

    const allowedExts: ReadonlySet<string> = new Set(
      rule.matcher.kind === 'js'
        ? JS_RULE_EXTENSIONS
        : rule.matcher.kind === 'css'
          ? CSS_RULE_EXTENSIONS
          : DOM_RULE_EXTENSIONS,
    );
    const applicableFixtures = syntheticFixtureCorpus.filter((fixture) =>
      allowedExts.has(extname(fixture.name)),
    );
    const matchedFixtures = applicableFixtures.filter((fixture) =>
      matchesFastTokens(fixture.content, fastTokens),
    );
    const matchRatio = matchedFixtures.length / applicableFixtures.length;
    assert.ok(
      matchRatio <= 0.25,
      `Rule "${rule.id}" fastTokens ${JSON.stringify(fastTokens)} matched ${matchedFixtures.length}/${applicableFixtures.length} (${(matchRatio * 100).toFixed(0)}%) applicable synthetic fixtures (${matchedFixtures.map((f) => f.name).join(', ')}); max allowed is 25%`,
    );
  }
}

describe('qualified rules architectural invariants', () => {
  it('enforces that every rule module file on disk in src/analyzing/rules is registered in RULE_MODULES', () => {
    const rulesDir = resolve(import.meta.dirname);
    const untrackedFiles = new Set<string>();
    const gitStatus = execSync('git status --porcelain src/analyzing/rules', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const line of gitStatus.split('\n')) {
      if (line.startsWith('?? ')) {
        const rel = line.slice(3).trim().replace(/^src\/analyzing\/rules\//, '');
        if (!rel.includes('/') && !rel.includes('\\') && rel.endsWith('.ts') && !rel.endsWith('.test.ts')) {
          untrackedFiles.add(rel.replace(/\.ts$/, ''));
        }
      }
    }

    const filesOnDisk = readdirSync(rulesDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts')
      .map((f) => f.replace(/\.ts$/, ''))
      .filter((f) => !untrackedFiles.has(f))
      .sort();

    const registeredGuideIds = RULE_MODULES.map((rules) => rules[0]!.guideId).sort();
    assert.deepStrictEqual(
      filesOnDisk,
      registeredGuideIds,
      'Rule modules on disk in src/analyzing/rules must exactly match RULE_MODULES',
    );
    assert.deepStrictEqual(
      QUALIFIED_GUIDE_IDS,
      registeredGuideIds,
      'QUALIFIED_GUIDE_IDS must equal the sorted unique guideIds of QUALIFIED_RULES',
    );
  });

  it('enforces that every qualified guide exists in the catalog with a non-stub guide.md', () => {
    const allGuides = scanAllGuides();
    const guideMap = new Map(allGuides.map((g) => [g.name, g]));

    for (const guideId of QUALIFIED_GUIDE_IDS) {
      const guide = guideMap.get(guideId);
      assert.ok(guide, `Qualified guide "${guideId}" does not exist in catalog!`);
      assert.ok(guide.isPublished, `Qualified guide "${guideId}" must be a published catalog guide`);
      assert.ok(!guide.isStub, `Guide "${guideId}" must not be a stub`);
    }
  });

  it('validates rule properties and default-export completeness for all qualified rule modules', async (t) => {
    const rulesDir = resolve(import.meta.dirname);
    const seenRegisteredRuleIds = new Set<string>();

    for (const moduleRules of RULE_MODULES) {
      assert.ok(moduleRules.length > 0, 'Every module in RULE_MODULES must export at least 1 rule');
      const guideId = moduleRules[0]!.guideId;
      const filePath = join(rulesDir, `${guideId}.ts`);
      const inspected = await inspectRuleModuleFiles(filePath);
      assert.ok(
        inspected.defaultRules.length > 0,
        `Rule module "${guideId}.ts" must default-export a non-empty rules array`,
      );
      assert.deepStrictEqual(
        inspected.defaultRules,
        moduleRules,
        `Default export of "${guideId}.ts" must equal its RULE_MODULES entry`,
      );

      assert.ok(
        inspected.exportedRules.length > 0,
        `Rule module "${guideId}.ts" must export at least one AnalyzerRule`,
      );
      for (const exportedRule of inspected.exportedRules) {
        assert.ok(
          moduleRules.includes(exportedRule),
          `Exported rule "${exportedRule.id}" in "${guideId}.ts" is missing from its default export`,
        );
      }

      assert.strictEqual(
        moduleRules.length,
        inspected.definedRuleCount,
        `Module "${guideId}.ts" defines ${inspected.definedRuleCount} AnalyzerRule object(s) (by verifierRubric:) but default-exports ${moduleRules.length}`,
      );

      for (const rule of moduleRules) {
        assert.ok(!seenRegisteredRuleIds.has(rule.id), `duplicate rule id: ${rule.id}`);
        seenRegisteredRuleIds.add(rule.id);

        await t.test(`rule ${rule.id} (${rule.guideId}) has valid structure`, () => {
          assert.ok(rule.id, 'rule has id');
          assert.strictEqual(rule.guideId, guideId, 'rule.guideId matches module guideId');
          assert.match(rule.guideHash, /^[0-9a-f]{12}$/, 'guideHash is 12 lowercase hex chars');
          assert.ok(rule.summary, 'rule has summary');
          assert.ok(rule.matcher, 'rule has matcher');
          assert.ok(rule.verifierRubric.keepWhen.length > 0, 'has keepWhen');
          assert.ok(rule.verifierRubric.dropWhen.length > 0, 'has dropWhen');
        });
      }
    }
  });

  it('enforces structural FastTokenSpec / packages invariant on every rule in QUALIFIED_RULES', () => {
    assertValidFastTokenSpecs(QUALIFIED_RULES);
  });

  it('enforces anti-sponge selectivity gate on fastTokens across QUALIFIED_RULES', () => {
    assertAntiSpongeSelectivity(QUALIFIED_RULES);
  });

  it('enforces zero self-hits when running each qualified rule against its own guide demo.html', () => {
    const allGuides = scanAllGuides();
    const guideMap = new Map(allGuides.map((g) => [g.name, g]));

    for (const rule of QUALIFIED_RULES) {
      const guide = guideMap.get(rule.guideId);
      if (!guide || !guide.hasDemo) {
        continue;
      }
      const demoPath = join(guide.dir, 'demo.html');
      const demoContent = readFileSync(demoPath, 'utf8');
      const findings = scanFiles(new Map([[demoPath, demoContent]]), [rule], {
        includeDocsAndTests: true,
      });
      assert.strictEqual(
        findings.length,
        0,
        `Rule "${rule.id}" must produce 0 self-hits on its own guide demo.html (${demoPath}), but found ${findings.length}:\n` +
          findings.map((f) => `  line ${f.line}: ${f.message}`).join('\n'),
      );
    }
  });
});
