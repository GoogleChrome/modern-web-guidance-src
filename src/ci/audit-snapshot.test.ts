import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  type AuditFinding,
  type AuditSnapshot,
  computeAuditStaleSlugs,
  evaluateAuditStatus,
  fetchLatestAuditSnapshots,
  isFlaggingFinding,
  renderAuditFindingsSection,
  renderAuditRow,
  validateAuditSnapshot,
} from './audit-snapshot.ts';
import { type GuideInventory, ProjectStatus } from '../core/guide-validation.ts';
import { rootDir } from '../core/paths.ts';
import { PIPELINE_SCALE_MAX } from './sync-pipeline-issue.ts';

function makeGuide(overrides: Partial<GuideInventory> = {}): GuideInventory {
  const category = overrides.category ?? 'ui-components';
  const name = overrides.name ?? 'sample-guide';
  const dir = path.join(rootDir, 'guides', category, name);
  return {
    name,
    category,
    dir,
    isStub: false,
    hasGuide: true,
    draft: false,
    isPublished: true,
    hasDemo: true,
    hasNegativeDemo: false,
    hasTask: true,
    hasExpectations: true,
    expectationsEmpty: false,
    hasGrader: true,
    isDisciplineGuide: false,
    targets: [
      {
        name: 'daily-grind',
        dir: path.join(dir, 'targets', 'daily-grind'),
        hasSolution: true,
        hasZeroPassrate: true,
        hasGrader: true,
        hasTask: true,
      },
    ],
    featureIds: [name],
    ...overrides,
  };
}

describe('validateAuditSnapshot boundary validator', () => {
  it('validates a well-formed audit snapshot', () => {
    const raw = {
      schemaVersion: 1,
      source: 'expectations-coverage',
      auditedAt: '2026-09-24T20:50:15.853Z',
      auditedSha: 'e17f2c81da5dc393faddc3cca5757ede9dd29961',
      tool: 'gd audit-evals',
      guides: {
        'built-in-ai/language-detection': [
          { code: 'CONTRADICTS_GUIDE', severity: 'HIGH', file: 'expectations.md', note: 'sample note' },
          { code: 'MISSING_CORE_REQUIREMENT', severity: 'LOW' },
        ],
        'ui-components/dialog': [],
      },
    };

    const validated = validateAuditSnapshot(raw, 'test.json');
    assert.equal(validated.schemaVersion, 1);
    assert.equal(validated.source, 'expectations-coverage');
    assert.equal(validated.auditedSha, 'e17f2c81da5dc393faddc3cca5757ede9dd29961');
    assert.equal(validated.guides['built-in-ai/language-detection'].length, 2);
    assert.equal(validated.guides['built-in-ai/language-detection'][0].severity, 'HIGH');
    assert.equal(validated.guides['built-in-ai/language-detection'][1].severity, 'LOW');
    assert.equal(validated.guides['ui-components/dialog'].length, 0);
  });

  it('accepts P0, HIGH, MEDIUM, and LOW severity strings case-insensitively', () => {
    const raw = {
      schemaVersion: 1,
      source: 'eval-defects',
      auditedAt: '2026-10-12T20:39:15Z',
      auditedSha: '536ff1ab80abb9df6f1a96cbe2294fe81f83d223',
      tool: 'gh pr view 1998',
      guides: {
        'built-in-ai/language-model': [
          { code: 'G-CONDITIONAL-VACUOUS', severity: 'p0' },
          { code: 'G-VACUOUS', severity: 'high' },
          { code: 'E-NOT-IN-GUIDE', severity: 'med' },
          { code: 'E-UNNECESSARY-FALLBACK', severity: 'low' },
        ],
      },
    };

    const validated = validateAuditSnapshot(raw);
    const findings = validated.guides['built-in-ai/language-model'];
    assert.equal(findings[0].severity, 'P0');
    assert.equal(findings[1].severity, 'HIGH');
    assert.equal(findings[2].severity, 'MEDIUM');
    assert.equal(findings[3].severity, 'LOW');
  });

  it('rejects invalid schemaVersion, missing source, invalid dates, and invalid SHAs', () => {
    assert.throws(
      () => validateAuditSnapshot({ schemaVersion: 0, source: 'x', auditedAt: '2026-01-01', auditedSha: 'abc1234', tool: 't', guides: {} }),
      /schemaVersion must be a positive integer/
    );

    assert.throws(
      () => validateAuditSnapshot({ schemaVersion: 1, source: '', auditedAt: '2026-01-01', auditedSha: 'abc1234', tool: 't', guides: {} }),
      /source must be a non-empty string/
    );

    assert.throws(
      () => validateAuditSnapshot({ schemaVersion: 1, source: 's', auditedAt: 'invalid-date', auditedSha: 'abc1234', tool: 't', guides: {} }),
      /auditedAt must be a valid ISO 8601 date string/
    );

    assert.throws(
      () => validateAuditSnapshot({ schemaVersion: 1, source: 's', auditedAt: '2026-01-01T00:00:00Z', auditedSha: 'not-a-sha', tool: 't', guides: {} }),
      /auditedSha must be a valid git commit SHA/
    );
  });

  it('rejects invalid findings or unknown severities', () => {
    assert.throws(
      () =>
        validateAuditSnapshot({
          schemaVersion: 1,
          source: 's',
          auditedAt: '2026-01-01T00:00:00Z',
          auditedSha: '536ff1ab80abb9df6f1a96cbe2294fe81f83d223',
          tool: 't',
          guides: {
            'forms/switch': [{ code: 'TEST', severity: 'CRITICAL' }],
          },
        }),
      /Expected P0, HIGH, MEDIUM, or LOW/
    );
  });
});

describe('renderAuditRow progress bar rendering', () => {
  it('renders exact 73-column bar with clean, flagged, and stale counts', () => {
    const row = renderAuditRow({
      clean: 118,
      flagged: 22,
      staleCount: 9,
      baseline: 127,
      scaleMax: PIPELINE_SCALE_MAX, // 200
    });

    assert.ok(row.startsWith('Audited   '));
    assert.ok(row.endsWith('  118 clean · 22 flagged (9 stale)'));

    // Extract the bar characters between label (10 chars) and end metrics
    const barMatch = /^Audited\s+([█░·]+)\s+118 clean/.exec(row);
    assert.ok(barMatch, `Row did not match expected structure: ${row}`);
    const bar = barMatch[1];
    assert.equal(bar.length, PIPELINE_SCALE_MAX - 127, `Bar width should equal ${PIPELINE_SCALE_MAX - 127}`);
  });

  it('omits stale clause when stale count is 0 or omitted', () => {
    const row = renderAuditRow({
      clean: 130,
      flagged: 10,
      staleCount: 0,
      baseline: 127,
      scaleMax: 200,
    });
    assert.ok(row.endsWith('  130 clean · 10 flagged'));
    assert.ok(!row.includes('stale'));
  });

  it('safely clamps bar columns when clean exceeds goal or is below baseline', () => {
    const overRow = renderAuditRow({
      clean: 210,
      flagged: 5,
      baseline: 127,
      scaleMax: 200,
    });
    const barMatch = /^Audited\s+([█░·]+)\s+/.exec(overRow);
    assert.ok(barMatch);
    assert.equal(barMatch[1], '█'.repeat(73));

    const underRow = renderAuditRow({
      clean: 50,
      flagged: 20,
      baseline: 127,
      scaleMax: 200,
    });
    const underMatch = /^Audited\s+([█░·]+)\s+/.exec(underRow);
    assert.ok(underMatch);
    assert.equal(underMatch[1], '░'.repeat(20) + '·'.repeat(53));
  });
});

describe('evaluateAuditStatus and staleness', () => {
  it('correctly categorizes clean and flagged guides and tracks stale findings', () => {
    const guide1 = makeGuide({ category: 'css', name: 'animate-to-intrinsic-sizes' });
    const guide2 = makeGuide({ category: 'built-in-ai', name: 'language-model' });
    const guide3 = makeGuide({ category: 'ui-components', name: 'stack-drill-down' });

    const snapshot1: AuditSnapshot = {
      schemaVersion: 1,
      source: 'expectations-coverage',
      auditedAt: '2026-09-24T20:50:15.853Z',
      auditedSha: 'e17f2c81da5dc393faddc3cca5757ede9dd29961',
      tool: 'gd audit-evals',
      guides: {
        'built-in-ai/language-model': [{ code: 'CONTRADICTS_GUIDE', severity: 'HIGH', file: 'expectations.md' }],
        'css/animate-to-intrinsic-sizes': [{ code: 'VAGUE_EXPECTATION', severity: 'LOW' }], // not flagging
      },
    };

    const snapshot2: AuditSnapshot = {
      schemaVersion: 1,
      source: 'eval-defects',
      auditedAt: '2026-10-12T20:39:15Z',
      auditedSha: '536ff1ab80abb9df6f1a96cbe2294fe81f83d223',
      tool: 'gh pr view 1998',
      guides: {
        'ui-components/stack-drill-down': [{ code: 'G-ENV-FLAKY', severity: 'P0', file: 'grader.ts' }],
      },
    };

    const summary = evaluateAuditStatus({
      guides: [guide1, guide2, guide3],
      snapshots: [snapshot1, snapshot2],
    });

    assert.equal(summary.cleanCount, 1);
    assert.deepEqual(summary.cleanSlugs, ['css/animate-to-intrinsic-sizes']);

    assert.equal(summary.flaggedCount, 2);
    const flaggedSlugs = summary.flaggedGuides.map(g => g.slug);
    assert.ok(flaggedSlugs.includes('built-in-ai/language-model'));
    assert.ok(flaggedSlugs.includes('ui-components/stack-drill-down'));

    assert.equal(summary.codeCounts['CONTRADICTS_GUIDE'], 1);
    assert.equal(summary.codeCounts['G-ENV-FLAKY'], 1);
  });

  it('renders markdown audit findings section with links and defect codes tally', () => {
    const summary = {
      cleanCount: 118,
      flaggedCount: 22,
      staleCount: 9,
      cleanSlugs: ['clean/guide'],
      flaggedGuides: [
        {
          slug: 'built-in-ai/language-model',
          findings: [
            { source: 'eval-defects', code: 'G-CONDITIONAL-VACUOUS', severity: 'HIGH' as const, file: 'grader.ts' },
            { source: 'eval-defects', code: 'P-LEAK-API', severity: 'HIGH' as const, file: 'tasks/task.md' },
          ],
          isStale: true,
        },
      ],
      codeCounts: {
        'G-CONDITIONAL-VACUOUS': 24,
        'P-LEAK-API': 19,
      },
      snapshots: [
        {
          schemaVersion: 1,
          source: 'expectations-coverage',
          auditedAt: '2026-09-24T20:50:15.853Z',
          auditedSha: 'e17f2c81da5dc393faddc3cca5757ede9dd29961',
          tool: 'gd audit-evals',
          assetName: 'audit-2026-09-24-expectations-coverage.json',
          guides: {},
        },
      ],
    };

    const section = renderAuditFindingsSection(summary);
    assert.ok(section.includes('## Quality Audits (118 clean · 22 flagged · 9 stale)'));
    assert.ok(section.includes('### Snapshot Sources'));
    assert.ok(section.includes('`audit-2026-09-24-expectations-coverage.json`'));
    assert.ok(section.includes('| `G-CONDITIONAL-VACUOUS` | **24** |'));
    assert.ok(section.includes('[**built-in-ai/language-model**]'));
    assert.ok(section.includes('*(stale)*'));
  });
});
