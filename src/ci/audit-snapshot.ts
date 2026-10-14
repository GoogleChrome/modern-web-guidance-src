import child_process from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  type GuideInventory,
  getGuideStatus,
  isDisciplineGuide,
  ProjectStatus,
} from '../core/guide-validation.ts';
import { rootDir } from '../core/paths.ts';
import {
  PIPELINE_SCALE_MAX,
  REPO_URL,
} from './sync-pipeline-issue.ts';

export const AUDIT_RELEASE_TAG = 'audit-data';

export type AuditSeverity = 'P0' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AuditFinding {
  code: string;
  severity: AuditSeverity;
  file?: string;
  note?: string;
}

export interface AuditSnapshot {
  schemaVersion: number;
  source: 'expectations-coverage' | 'eval-defects' | string;
  auditedAt: string;
  auditedSha: string;
  tool: string;
  assetName?: string;
  guides: Record<string, AuditFinding[]>;
}

export interface FlaggedFindingInfo {
  source: string;
  code: string;
  severity: AuditSeverity;
  file?: string;
  note?: string;
}

export interface FlaggedGuideItem {
  slug: string;
  findings: FlaggedFindingInfo[];
  isStale: boolean;
}

export interface AuditEvaluationSummary {
  cleanCount: number;
  flaggedCount: number;
  staleCount: number;
  cleanSlugs: string[];
  flaggedGuides: FlaggedGuideItem[];
  codeCounts: Record<string, number>;
  snapshots: AuditSnapshot[];
}

/**
 * Validates untrusted input as an AuditSnapshot at runtime boundary.
 * Throws explicit descriptive errors on missing or invalid fields.
 */
export function validateAuditSnapshot(raw: unknown, sourceIdentifier = 'input'): AuditSnapshot {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Invalid audit snapshot in ${sourceIdentifier}: expected an object root.`);
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.schemaVersion !== 'number' || !Number.isInteger(obj.schemaVersion) || obj.schemaVersion < 1) {
    throw new Error(`Invalid audit snapshot in ${sourceIdentifier}: schemaVersion must be a positive integer.`);
  }

  if (typeof obj.source !== 'string' || !obj.source.trim()) {
    throw new Error(`Invalid audit snapshot in ${sourceIdentifier}: source must be a non-empty string.`);
  }

  if (typeof obj.auditedAt !== 'string' || Number.isNaN(Date.parse(obj.auditedAt))) {
    throw new Error(`Invalid audit snapshot in ${sourceIdentifier}: auditedAt must be a valid ISO 8601 date string.`);
  }

  if (typeof obj.auditedSha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(obj.auditedSha.trim())) {
    throw new Error(`Invalid audit snapshot in ${sourceIdentifier}: auditedSha must be a valid git commit SHA.`);
  }

  if (typeof obj.tool !== 'string' || !obj.tool.trim()) {
    throw new Error(`Invalid audit snapshot in ${sourceIdentifier}: tool must be a non-empty string.`);
  }

  if (typeof obj.guides !== 'object' || obj.guides === null || Array.isArray(obj.guides)) {
    throw new Error(`Invalid audit snapshot in ${sourceIdentifier}: guides must be a dictionary object.`);
  }

  const guidesObj = obj.guides as Record<string, unknown>;
  const validatedGuides: Record<string, AuditFinding[]> = {};

  for (const [slug, findingsRaw] of Object.entries(guidesObj)) {
    if (!Array.isArray(findingsRaw)) {
      throw new Error(`Invalid audit snapshot in ${sourceIdentifier}: guides["${slug}"] must be an array of findings.`);
    }

    const validatedFindings: AuditFinding[] = [];
    for (let i = 0; i < findingsRaw.length; i++) {
      const f = findingsRaw[i];
      if (typeof f !== 'object' || f === null || Array.isArray(f)) {
        throw new Error(`Invalid finding at index ${i} in guide "${slug}" (${sourceIdentifier}): expected an object.`);
      }
      const findingObj = f as Record<string, unknown>;

      if (typeof findingObj.code !== 'string' || !findingObj.code.trim()) {
        throw new Error(`Invalid finding code at index ${i} in guide "${slug}" (${sourceIdentifier}).`);
      }

      const rawSev = typeof findingObj.severity === 'string' ? findingObj.severity.toUpperCase().trim() : '';
      let severity: AuditSeverity;
      if (rawSev === 'P0' || rawSev === 'HIGH') {
        severity = rawSev as AuditSeverity;
      } else if (rawSev === 'MED' || rawSev === 'MEDIUM') {
        severity = 'MEDIUM';
      } else if (rawSev === 'LOW') {
        severity = 'LOW';
      } else {
        throw new Error(
          `Invalid finding severity "${findingObj.severity}" at index ${i} in guide "${slug}" (${sourceIdentifier}). Expected P0, HIGH, MEDIUM, or LOW.`
        );
      }

      const finding: AuditFinding = {
        code: findingObj.code.trim(),
        severity,
      };

      if (findingObj.file !== undefined) {
        if (typeof findingObj.file !== 'string') {
          throw new Error(`Invalid finding file property at index ${i} in guide "${slug}" (${sourceIdentifier}).`);
        }
        finding.file = findingObj.file.trim();
      }

      if (findingObj.note !== undefined) {
        if (typeof findingObj.note !== 'string') {
          throw new Error(`Invalid finding note property at index ${i} in guide "${slug}" (${sourceIdentifier}).`);
        }
        finding.note = findingObj.note.trim();
      }

      validatedFindings.push(finding);
    }

    validatedGuides[slug] = validatedFindings;
  }

  return {
    schemaVersion: obj.schemaVersion,
    source: obj.source.trim(),
    auditedAt: obj.auditedAt.trim(),
    auditedSha: obj.auditedSha.trim(),
    tool: obj.tool.trim(),
    assetName: typeof obj.assetName === 'string' ? obj.assetName : undefined,
    guides: validatedGuides,
  };
}

/**
 * Downloads and reads the latest audit snapshot per source from the GitHub release tag `audit-data`.
 * Fails loudly on any error other than "release not found". If release is missing, returns [].
 */
export function fetchLatestAuditSnapshots(options: {
  repo?: string;
  tag?: string;
  cwd?: string;
  tmpDir?: string;
} = {}): AuditSnapshot[] {
  const repo = options.repo ?? 'GoogleChrome/modern-web-guidance-src';
  const tag = options.tag ?? AUDIT_RELEASE_TAG;
  const cwd = options.cwd ?? rootDir;

  const tempDir = options.tmpDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'guidance-audit-snapshots-'));

  try {
    child_process.execFileSync(
      'gh',
      ['release', 'download', tag, '--repo', repo, '--pattern', 'audit-*.json', '--dir', tempDir, '--clobber'],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (err: unknown) {
    const errorOutput = err instanceof Error ? String((err as { stderr?: string }).stderr || err.message) : String(err);
    if (/release not found/i.test(errorOutput)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
      return [];
    }
    throw new Error(`Failed to download audit data from release tag "${tag}" in ${repo}: ${errorOutput}`);
  }

  const downloadedFiles = fs.readdirSync(tempDir).filter(f => f.startsWith('audit-') && f.endsWith('.json'));

  const snapshotsBySource = new Map<string, AuditSnapshot>();

  for (const file of downloadedFiles) {
    const fullPath = path.join(tempDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(content);
    const validated = validateAuditSnapshot(parsed, file);
    validated.assetName = file;

    const existing = snapshotsBySource.get(validated.source);
    if (!existing || Date.parse(validated.auditedAt) > Date.parse(existing.auditedAt)) {
      snapshotsBySource.set(validated.source, validated);
    }
  }

  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup error
  }

  return Array.from(snapshotsBySource.values()).sort((a, b) => a.source.localeCompare(b.source));
}

/**
 * Computes the set of guide slugs whose key files have changed since auditedSha.
 * Matches changes to guide.md, expectations.md, task.md, grader.ts, or anything inside targets/**.
 */
export function computeAuditStaleSlugs(auditedSha: string, options: { cwd?: string } = {}): Set<string> {
  const cwd = options.cwd ?? rootDir;
  const staleSlugs = new Set<string>();

  try {
    const output = child_process.execFileSync(
      'git',
      ['diff', '--name-only', auditedSha, 'HEAD', '--', 'guides/'],
      { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );

    for (const rawLine of output.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      // Match guide files that affect evaluation contract or implementation
      const match = /^guides\/([^/]+\/[^/]+)\/(guide\.md|expectations\.md|tasks?\/.*|grader\.ts|targets\/.*)$/.exec(line);
      if (match) {
        staleSlugs.add(match[1]);
      }
    }
  } catch {
    // If commit is unknown or diff fails, do not throw but leave empty set
  }

  return staleSlugs;
}

/**
 * Determines whether an audit finding is an open HIGH or P0 defect that flags a guide.
 */
export function isFlaggingFinding(finding: AuditFinding): boolean {
  return finding.severity === 'HIGH' || finding.severity === 'P0';
}

/**
 * Evaluates audit health across complete feature guides against the latest snapshot per source.
 */
export function evaluateAuditStatus(params: {
  guides: GuideInventory[];
  snapshots: AuditSnapshot[];
  cwd?: string;
}): AuditEvaluationSummary {
  const cwd = params.cwd ?? rootDir;

  // Complete feature guides (discipline hubs excluded)
  const completeGuides = params.guides.filter(
    g => g.category !== 'test-results' && !isDisciplineGuide(g.name, g.category) && !g.isDisciplineGuide && getGuideStatus(g) === null && g.hasGrader
  );

  // Precompute stale slugs per snapshot SHA (one git call per unique SHA)
  const staleSlugsBySha = new Map<string, Set<string>>();
  for (const s of params.snapshots) {
    if (!staleSlugsBySha.has(s.auditedSha)) {
      staleSlugsBySha.set(s.auditedSha, computeAuditStaleSlugs(s.auditedSha, { cwd }));
    }
  }

  const cleanSlugs: string[] = [];
  const flaggedGuides: FlaggedGuideItem[] = [];
  const codeCounts: Record<string, number> = {};

  for (const g of completeGuides) {
    const slug = `${g.category}/${g.name}`;
    const openFindings: FlaggedFindingInfo[] = [];
    let isStale = false;

    for (const snapshot of params.snapshots) {
      const guideFindings = snapshot.guides[slug] || [];
      const flagging = guideFindings.filter(isFlaggingFinding);
      const staleSet = staleSlugsBySha.get(snapshot.auditedSha);

      if (flagging.length > 0) {
        for (const f of flagging) {
          openFindings.push({
            source: snapshot.source,
            code: f.code,
            severity: f.severity,
            file: f.file,
            note: f.note,
          });
          codeCounts[f.code] = (codeCounts[f.code] || 0) + 1;
        }
        if (staleSet && staleSet.has(slug)) {
          isStale = true;
        }
      }
    }

    if (openFindings.length > 0) {
      flaggedGuides.push({
        slug,
        findings: openFindings,
        isStale,
      });
    } else {
      cleanSlugs.push(slug);
    }
  }

  cleanSlugs.sort((a, b) => a.localeCompare(b));
  flaggedGuides.sort((a, b) => b.findings.length - a.findings.length || a.slug.localeCompare(b.slug));

  const staleCount = flaggedGuides.filter(g => g.isStale).length;

  return {
    cleanCount: cleanSlugs.length,
    flaggedCount: flaggedGuides.length,
    staleCount,
    cleanSlugs,
    flaggedGuides,
    codeCounts,
    snapshots: params.snapshots,
  };
}

/**
 * Renders the baseline-relative "Audited" progress bar row.
 * █ = complete guides with no open HIGH/P0 finding in the latest audit of each source
 * ░ = complete guides with findings
 * · = remaining to goal
 * Label format: `118 clean · 22 flagged (9 stale)` (bigger-is-better framing).
 */
export function renderAuditRow(params: {
  clean: number;
  flagged: number;
  baseline: number;
  staleCount?: number;
  scaleMax?: number;
}): string {
  const scaleMax = params.scaleMax ?? PIPELINE_SCALE_MAX;
  const baseline = params.baseline;
  const barWidth = Math.max(1, scaleMax - baseline);

  const cleanCols = Math.max(0, Math.min(barWidth, params.clean - baseline));
  const flaggedCols = Math.max(0, Math.min(barWidth - cleanCols, params.flagged));
  const remainingCols = Math.max(0, barWidth - cleanCols - flaggedCols);

  const bar = '█'.repeat(cleanCols) + '░'.repeat(flaggedCols) + '·'.repeat(remainingCols);
  const stalePart = params.staleCount && params.staleCount > 0 ? ` (${params.staleCount} stale)` : '';

  return `${'Audited'.padEnd(10)}${bar}  ${params.clean} clean · ${params.flagged} flagged${stalePart}`;
}

/**
 * Renders the compact Markdown "Audit Findings" section for the tracker issue.
 */
export function renderAuditFindingsSection(evalSummary: AuditEvaluationSummary): string {
  if (evalSummary.snapshots.length === 0) {
    return '';
  }

  const lines: string[] = [
    '---',
    '',
    `## Quality Audits (${evalSummary.cleanCount} clean · ${evalSummary.flaggedCount} flagged${
      evalSummary.staleCount > 0 ? ` · ${evalSummary.staleCount} stale` : ''
    })`,
    '',
    '### Snapshot Sources',
    '',
  ];

  for (const s of evalSummary.snapshots) {
    const shortSha = s.auditedSha.slice(0, 7);
    const commitUrl = `${REPO_URL}/commit/${s.auditedSha}`;
    const releaseUrl = `${REPO_URL}/releases/tag/${AUDIT_RELEASE_TAG}`;
    const dateStr = s.auditedAt.split('T')[0];
    const assetPart = s.assetName ? ` (\`${s.assetName}\`)` : '';
    lines.push(`- [**${s.source}**](${releaseUrl})${assetPart} · audited ${dateStr} at [\`${shortSha}\`](${commitUrl}) via \`${s.tool}\``);
  }

  lines.push('', '### Defect Codes Tally', '', '| Defect Code | Open Findings | Severity |', '| :--- | ---: | :--- |');

  const sortedCodes = Object.entries(evalSummary.codeCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [code, count] of sortedCodes) {
    lines.push(`| \`${code}\` | **${count}** | \`HIGH/P0\` |`);
  }

  lines.push('', '### Top Flagged Guides', '');

  const topGuides = evalSummary.flaggedGuides.slice(0, 15);
  for (const item of topGuides) {
    const stalePart = item.isStale ? ' *(stale)*' : '';
    const codesList = [...new Set(item.findings.map(f => f.code))].map(c => `\`${c}\``).join(', ');
    const guideUrl = `${REPO_URL}/tree/main/guides/${item.slug}`;
    lines.push(`- [ ] [**${item.slug}**](${guideUrl}) · **${item.findings.length}** open [${codesList}]${stalePart}`);
  }

  if (evalSummary.flaggedGuides.length > 15) {
    lines.push(
      '',
      `<details>`,
      `<summary>Show all ${evalSummary.flaggedGuides.length} flagged guides</summary>`,
      ''
    );
    for (const item of evalSummary.flaggedGuides.slice(15)) {
      const stalePart = item.isStale ? ' *(stale)*' : '';
      const codesList = [...new Set(item.findings.map(f => f.code))].map(c => `\`${c}\``).join(', ');
      const guideUrl = `${REPO_URL}/tree/main/guides/${item.slug}`;
      lines.push(`- [ ] [**${item.slug}**](${guideUrl}) · **${item.findings.length}** open [${codesList}]${stalePart}`);
    }
    lines.push('', '</details>');
  }

  return lines.join('\n');
}
