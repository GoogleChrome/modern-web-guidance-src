import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  classifyRepoFile,
  extractFeatureIdsFromContent,
  extractNoreplyLogin,
  featureGroups,
  findGuidesTranscludingFeature,
  getKnownCategories,
  isContentRelatedIssue,
  isSmeContentFile,
  normalizeLabel,
  parsePrimaryBlameAuthor,
  planIssueTriage,
  planPrRouting,
  resolveInfraReviewers,
  selectLeadReviewer,
  upsertDemoPreviewInBody,
  type AtlConfig
} from './reviewer-routing.ts';

const baseConfig: AtlConfig = {
  default: {
    performance: ['rviscomi', 'paulirish'],
    accessibility: 'rviscomi',
    'css-layout': 'malchata',
    motion: 'philipwalton',
    css: 'LeaVerou'
  },
  web_features: {
    'image-set': 'override-pr-reviewer',
    'canvas-html': 'override-issue-reviewer',
    'user-action-pseudos': 'user-action-reviewer'
  },
  web_features_groups: {
    scrolling: 'group-issue-reviewer'
  }
};

describe('classifyRepoFile, isSmeContentFile & resolveInfraReviewers', () => {
  it('classifies SME content, guide assets, eval fixtures, and infra files without ownerless holes', () => {
    assert.equal(isSmeContentFile('guides/css/style-parent-with-has/guide.md'), true);
    assert.equal(isSmeContentFile('guides/css/style-parent-with-has/demo.html'), true);
    assert.equal(isSmeContentFile('guides/css/style-parent-with-has/expectations.md'), true);
    assert.equal(isSmeContentFile('guides/css/css/guide.md'), true);
    assert.equal(isSmeContentFile('guides/modern-web-guidance/SKILL.md'), true);
    assert.equal(isSmeContentFile('skills-src/chrome-extensions/SKILL.md'), true);
    assert.equal(isSmeContentFile('features/scrollbar-color.md'), true);
    assert.equal(isSmeContentFile('features/pending-web-features.json'), true);

    assert.equal(isSmeContentFile('guides/css/style-parent-with-has/demo-vertical.html'), false);
    assert.equal(isSmeContentFile('guides/css/style-parent-with-has/grader.ts'), false);
    assert.equal(isSmeContentFile('guides/test-fixture.ts'), false);
    assert.equal(isSmeContentFile('guides/CONTRIBUTING.md'), false);
    assert.equal(isSmeContentFile('features/sub/deep.md'), false);
    assert.equal(classifyRepoFile('../escape.md').kind, 'infra');

    // Guide content, guide demo variants/assets, skills, and features route 0 infra reviewers:
    assert.deepEqual(
      resolveInfraReviewers([
        'guides/css/anchor/guide.md',
        'guides/css/anchor/demo-vertical.html',
        'guides/css/anchor/assets/diagram.svg',
        'guides/modern-web-guidance/SKILL.md',
        'features/popover.md',
        'features/pending-web-features.json',
        'skills-src/baseline/SKILL.md'
      ]),
      []
    );

    // Top-level guides/test-fixture.ts and guide graders/targets route to EVAL_OWNERS:
    assert.deepEqual(resolveInfraReviewers(['guides/test-fixture.ts']), ['TravenReese', 'micahjo7', 'lusayaa']);
    assert.deepEqual(resolveInfraReviewers(['guides/css/anchor/grader.ts']), ['TravenReese', 'micahjo7', 'lusayaa']);

    // Top-level guides/lib/* and guides/CONTRIBUTING.md route to DEFAULT_INFRA_OWNERS (not ownerless!):
    assert.deepEqual(resolveInfraReviewers(['guides/lib/helper.ts']), ['paulirish', 'micahjo7', 'lusayaa']);
    assert.deepEqual(resolveInfraReviewers(['guides/CONTRIBUTING.md']), ['paulirish', 'micahjo7', 'lusayaa']);
    assert.deepEqual(resolveInfraReviewers(['src/harness/public/scrub.ts']), ['paulirish', 'micahjo7', 'TravenReese']);
    assert.deepEqual(resolveInfraReviewers(['.github/atls.json']), ['paulirish', 'rviscomi', 'micahjo7', 'lusayaa']);
  });
});

describe('categories, labels & transclusion helpers', () => {
  it('normalizes labels and discovers static + dynamic categories', () => {
    assert.equal(normalizeLabel('category:Performance'), 'performance');
    assert.equal(normalizeLabel('guide:css-layout'), 'css-layout');
    assert.equal(normalizeLabel('guides:accessibility'), 'accessibility');
    assert.equal(normalizeLabel('extensions'), 'chrome-extensions');

    const cats = getKnownCategories(undefined, { default: { 'brand-new': 'x' }, web_features: {}, web_features_groups: {} });
    assert.ok(cats.has('css') && cats.has('user-experience') && cats.has('wasm') && cats.has('motion') && cats.has('brand-new'));
    assert.ok(!cats.has('lib') && !cats.has('modern-web-guidance'));

    assert.equal(isContentRelatedIssue(['new-feature'], ''), true);
    assert.equal(isContentRelatedIssue(['category:performance'], ''), true);
    assert.equal(isContentRelatedIssue([], 'Use case subdir: [guides/css/foo](url)'), true);
    assert.equal(isContentRelatedIssue([], '### web-feature-id\ncanvas-html'), true);
    assert.equal(isContentRelatedIssue(['Tooling'], 'Fix CLI flag'), false);
  });

  it('extracts frontmatter feature IDs, finds transcluding guides, and upserts demo preview links', () => {
    assert.deepEqual(
      extractFeatureIdsFromContent('---\nname: x\nweb-feature-ids:\n  - popover\n  - anchor\ndescription: y\n---\n# Body'),
      ['popover', 'anchor']
    );
    assert.deepEqual(extractFeatureIdsFromContent('# No frontmatter'), []);

    assert.ok(findGuidesTranscludingFeature('scrollbar-color').some(m => m.category === 'visual-design'));

    const body = '## Summary\n\nImproves dialog demo.';
    const updated = upsertDemoPreviewInBody('feat-branch', body, ['guides/ui-components/dialog/demo.html']);
    assert.ok(updated.includes('[`ui-components/dialog`]'));
    assert.equal(upsertDemoPreviewInBody('feat-branch', updated, ['guides/ui-components/dialog/demo.html']), updated);
    assert.equal(upsertDemoPreviewInBody('feat-branch', updated, ['README.md']), body);
  });
});

describe('parsePrimaryBlameAuthor & selectLeadReviewer', () => {
  it('extracts numeric noreply logins and ignores frontmatter/blank lines in git blame', () => {
    assert.equal(extractNoreplyLogin('41588129+dvdherron@users.noreply.github.com'), 'dvdherron');
    assert.equal(extractNoreplyLogin('stu@alwaystwisted.com'), null);
    assert.equal(extractNoreplyLogin('rviscomi@users.noreply.github.com'), null);

    const guide = ['---', 'name: sample', '---', '', ...Array.from({ length: 12 }, (_, i) => `Rule ${i + 1}`)].join('\n');
    const stubSha = 'a'.repeat(40);
    const bodySha = 'b'.repeat(40);
    const porcelain = guide
      .split('\n')
      .map((t, i) => {
        const ln = i + 1;
        const sha = ln <= 3 ? stubSha : bodySha;
        const mail = ln <= 3 ? '<stub@example.com>' : '<jamesnw@gmail.com>';
        return `${sha} ${ln} ${ln} 1\nauthor-mail ${mail}\n\t${t}`;
      })
      .join('\n');

    assert.deepEqual(parsePrimaryBlameAuthor(guide, porcelain), {
      email: 'jamesnw@gmail.com',
      sha: bodySha,
      bodyLines: 12,
      share: 1
    });
    assert.equal(parsePrimaryBlameAuthor('---\nname: stub\n---\n', ''), null);
  });

  it('cascades waterfall tiers, preserves reviewed/sticky leads, and breaks ties by openReviewCounts', () => {
    const tiers = [['jamesnw'], ['bramus'], ['LJWatson', 'jenjknoll']];
    assert.equal(selectLeadReviewer({ tiers, excludedLogins: new Set() }), 'jamesnw');
    assert.equal(selectLeadReviewer({ tiers, excludedLogins: new Set(['jamesnw']) }), 'bramus');
    assert.equal(
      selectLeadReviewer({
        tiers,
        excludedLogins: new Set(['jamesnw', 'bramus']),
        openReviewCounts: new Map([['ljwatson', 5], ['jenjknoll', 1]]),
        tieSeed: 100
      }),
      'jenjknoll'
    );
    assert.equal(
      selectLeadReviewer({
        tiers,
        excludedLogins: new Set(['jamesnw', 'bramus']),
        alreadyRequestedLogins: new Set(['ljwatson']),
        openReviewCounts: new Map([['ljwatson', 5], ['jenjknoll', 1]]),
        tieSeed: 100
      }),
      'LJWatson'
    );
    assert.equal(
      selectLeadReviewer({
        tiers: [['jamesnw'], ['LeaVerou']],
        excludedLogins: new Set(),
        alreadyReviewedLogins: new Set(['leaverou'])
      }),
      'LeaVerou'
    );
    // Pending Tier 1 lead is NOT displaced when a Tier 2 reviewer reviews first:
    assert.equal(
      selectLeadReviewer({
        tiers: [['jamesnw'], ['LeaVerou']],
        excludedLogins: new Set(),
        alreadyRequestedLogins: new Set(['jamesnw']),
        alreadyReviewedLogins: new Set(['leaverou'])
      }),
      'jamesnw'
    );
  });
});

describe('planPrRouting', () => {
  it('routes 1 lead per guide/skill/feature via primary-author > feature > group > category waterfall', () => {
    // Guide waterfall + author cascade
    const p1 = planPrRouting({
      prNumber: 99998,
      author: 'override-pr-reviewer',
      labels: [],
      files: [
        'guides/performance/deliver-optimized-decorative-images/guide.md',
        'guides/motion/carousel-slide-effects/expectations.md'
      ],
      atlConfig: baseConfig
    });
    assert.deepEqual(p1.contentReviewers.sort(), ['philipwalton', 'rviscomi'].sort());
    assert.deepEqual(p1.labelsToAdd, ['content']);

    // Tier 1 primary author wins over category default, cascades when PR author, and keeps needs-atl on unowned category
    const pAuthor = planPrRouting({
      prNumber: 4001,
      author: 'other-peer',
      labels: ['content'],
      files: ['guides/css/style-parent-with-has/guide.md'],
      atlConfig: baseConfig,
      readGuidePrimaryAuthor: () => 'jamesnw'
    });
    assert.deepEqual(pAuthor.contentReviewers, ['jamesnw']);

    // Manual removal of Tier 1 primary author cascades to category default:
    const pRemovedAuthor = planPrRouting({
      prNumber: 4001,
      author: 'other-peer',
      labels: ['content'],
      files: ['guides/css/style-parent-with-has/guide.md'],
      atlConfig: baseConfig,
      removedReviewers: new Set(['jamesnw']),
      readGuidePrimaryAuthor: () => 'jamesnw'
    });
    assert.deepEqual(pRemovedAuthor.contentReviewers, ['LeaVerou']);

    const pUnownedSelf = planPrRouting({
      prNumber: 4002,
      author: 'jamesnw',
      labels: ['content'],
      files: ['guides/css/style-parent-with-has/guide.md'],
      atlConfig: { default: {}, web_features: {}, web_features_groups: {} },
      readGuidePrimaryAuthor: () => 'jamesnw'
    });
    assert.deepEqual(pUnownedSelf.contentReviewers, []);
    assert.deepEqual(pUnownedSelf.labelsToAdd, ['needs-atl']);

    // Fork PR guide frontmatter + standalone skill load tie-break
    const pSkillAndFork = planPrRouting({
      prNumber: 789,
      author: 'fork-user',
      labels: [],
      files: ['guides/custom-cat/new-guide/guide.md', 'skills-src/chrome-extensions/SKILL.md'],
      atlConfig: {
        default: { 'custom-cat': 'cat-owner', 'chrome-extensions': ['oliverdunk', 'patrickkettner'] },
        web_features: { 'user-pseudos': 'pseudos-owner' },
        web_features_groups: {}
      },
      openReviewCounts: new Map([['oliverdunk', 3], ['patrickkettner', 1]]),
      readPrGuideContent: () => '---\nweb-feature-ids:\n  - user-pseudos\n---\n# Fork Guide\n'
    });
    assert.deepEqual(pSkillAndFork.contentReviewers.sort(), ['patrickkettner', 'pseudos-owner'].sort());

    // Feature file direct > group > transcluding category waterfall
    const pFeature = planPrRouting({
      prNumber: 99998,
      author: 'user-pseudos-owner',
      labels: [],
      files: ['features/user-pseudos.md'],
      atlConfig: {
        default: { css: 'css-owner', forms: 'forms-owner' },
        web_features: { 'user-pseudos': 'user-pseudos-owner' },
        web_features_groups: {}
      },
      openReviewCounts: new Map([['css-owner', 0], ['forms-owner', 2]])
    });
    assert.deepEqual(pFeature.contentReviewers, ['css-owner']);
  });

  it('resolves pending tmp-* features and handles label/reviewer exclusions cleanly', async t => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-routing-'));
    featureGroups['tmp-mock-scrolling-feature'] = ['scrolling'];
    try {
      const guideDir = path.join(tmpDir, 'ui-behaviors', 'mock-guide');
      fs.mkdirSync(guideDir, { recursive: true });
      fs.writeFileSync(
        path.join(guideDir, 'guide.md'),
        '---\nweb-feature-ids:\n  - tmp-mock-scrolling-feature\n---\n# Guide\n',
        'utf8'
      );
      const res = planPrRouting({
        prNumber: 1,
        author: 'alice',
        labels: ['awaiting-cla', 'needs-atl'],
        files: ['guides/ui-behaviors/mock-guide/guide.md'],
        atlConfig: { default: {}, web_features: {}, web_features_groups: { scrolling: 'scroll-lead' } },
        guidesRootDir: tmpDir
      });
      assert.deepEqual(res.contentReviewers, ['scroll-lead']);
      assert.deepEqual(res.labelsToAdd, ['content']);
      assert.deepEqual(res.labelsToRemove, ['awaiting-cla', 'needs-atl']);
    } finally {
      delete featureGroups['tmp-mock-scrolling-feature'];
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const labelCases: Array<{
      name: string;
      files: string[];
      labels?: string[];
      unlabeled?: string[];
      expectedAdd: string[];
      expectedRemove: string[];
    }> = [
      {
        name: 'eval-only PR adds no content label',
        files: ['guides/performance/foo/targets/daily-grind/grader.ts'],
        labels: ['gd-dev-content'],
        expectedAdd: [],
        expectedRemove: []
      },
      {
        name: 'previously unlabeled content & needs-atl are not re-added',
        files: ['features/unknown-feature.md'],
        unlabeled: ['content', 'needs-atl'],
        expectedAdd: [],
        expectedRemove: []
      },
      {
        name: 'root skill labels content without needs-atl',
        files: ['guides/modern-web-guidance/SKILL.md'],
        expectedAdd: ['content'],
        expectedRemove: []
      },
      {
        name: 'non-content PR removes stale needs-atl',
        files: ['README.md'],
        labels: ['needs-atl'],
        expectedAdd: [],
        expectedRemove: ['needs-atl']
      }
    ];

    for (const c of labelCases) {
      await t.test(c.name, () => {
        const res = planPrRouting({
          prNumber: 10,
          author: 'alice',
          labels: c.labels ?? [],
          files: c.files,
          atlConfig: baseConfig,
          unlabeledLabels: new Set(c.unlabeled ?? [])
        });
        assert.deepEqual(res.labelsToAdd, c.expectedAdd);
        assert.deepEqual(res.labelsToRemove, c.expectedRemove);
      });
    }
  });
});

describe('planIssueTriage', () => {
  it('routes issue ATLs from labels, structured feature IDs, and templates while ignoring prose mentions', () => {
    assert.deepEqual(
      planIssueTriage({
        labels: ['category:performance'],
        description: '**Web Feature ID**: `canvas-html`',
        atlConfig: baseConfig
      }).assigneesToAdd.sort(),
      ['override-issue-reviewer', 'paulirish', 'rviscomi'].sort()
    );

    assert.deepEqual(
      planIssueTriage({
        labels: [],
        description: 'Prose mentioning canvas-html and smooth page transitions.',
        atlConfig: baseConfig
      }).assigneesToAdd,
      []
    );

    assert.deepEqual(
      planIssueTriage({
        labels: ['new-use-case'],
        description: '### Use case slug\nx\n\n### Category\n\ncss-layout\n',
        atlConfig: baseConfig
      }).assigneesToAdd,
      ['malchata']
    );

    // Filters unassigned & already-assigned ATLs, and manages needs-atl
    assert.deepEqual(
      planIssueTriage({
        labels: ['category:performance', 'needs-atl'],
        description: '',
        atlConfig: baseConfig,
        currentAssignees: ['rviscomi'],
        unassignedLoginsLower: new Set(['paulirish'])
      }),
      {
        matchedAtls: ['rviscomi', 'paulirish'],
        assigneesToAdd: [],
        labelsToAdd: [],
        labelsToRemove: ['needs-atl']
      }
    );

    assert.deepEqual(
      planIssueTriage({
        labels: ['new-feature'],
        description: 'Unknown feature',
        atlConfig: baseConfig
      }).labelsToAdd,
      ['needs-atl']
    );
  });
});
