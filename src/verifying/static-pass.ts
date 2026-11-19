/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { runAnalyzeCli } from '../analyzing/cli.ts';
import { USE_CASES } from '../rag/guides.ts';
import { runStaticPackChecks } from './packs.ts';
import {
  runWorkspaceEslintIfConfigured,
  stripCommentsPreservingLines,
} from './source-lexer.ts';
import type { FileRecord, ProjectConfig, VerificationFinding } from './types.ts';

export { stripCommentsPreservingLines };

const MAX_SCAN_CHARS_PER_FILE = 100_000;

let cachedGuideSet: Set<string> | null = null;

export function getVerifiedMwgGuideSet(): ReadonlySet<string> {
  if (!cachedGuideSet) {
    cachedGuideSet = new Set(USE_CASES.map((u) => u.id));
  }
  return cachedGuideSet;
}

export function filterVerifiedGuides(
  guideIds: readonly string[],
  guideSet: ReadonlySet<string> = getVerifiedMwgGuideSet(),
): string[] {
  return guideIds.filter((id) => Boolean(id) && guideSet.has(id));
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

export async function scanTouchedFilesWithLegacyScan(
  workspaceDir: string,
  touchedFiles: readonly string[],
): Promise<{
  available: boolean;
  matchedGuides: string[];
  findings: VerificationFinding[];
}> {
  if (touchedFiles.length === 0) {
    return { available: true, matchedGuides: [], findings: [] };
  }

  const touchedSet = new Set(touchedFiles.map((f) => f.replace(/\\/g, '/')));
  const targetArg = touchedFiles.length === 1 ? touchedFiles[0] : '.';
  const result = await runAnalyzeCli([targetArg, '--json'], { cwd: workspaceDir });
  if (result.exitCode !== 0 || !result.data) {
    return { available: false, matchedGuides: [], findings: [] };
  }

  const matchedGuides: string[] = [];
  const findings: VerificationFinding[] = [];

  for (const guideGroup of result.data.guides) {
    let guideMatched = false;
    for (const ruleGroup of guideGroup.rules) {
      for (const f of ruleGroup.findings) {
        const normFile = f.file.replace(/\\/g, '/');
        if (!touchedSet.has(normFile)) continue;
        guideMatched = true;
        findings.push({
          category: 'MODERNITY',
          severity: 'warning',
          file: normFile,
          line: f.line || 1,
          ruleId: ruleGroup.ruleId || guideGroup.guideId,
          message: f.message || ruleGroup.summary || `Legacy pattern (${guideGroup.guideId})`,
          guides: [guideGroup.guideId],
          fix: ruleGroup.summary || `Apply modern web guidance \`${guideGroup.guideId}\`.`,
        });
      }
    }
    if (guideMatched) {
      matchedGuides.push(guideGroup.guideId);
    }
  }

  return { available: true, matchedGuides, findings };
}

/**
 * Supplemental deterministic checks for high-frequency legacy patterns whose guides
 * (`position-aware-tooltips`, `copy-button`, `css-layout`) are not yet covered by
 * `modern-web-guidance`'s `legacy-scan` rule set.
 */
const SUPPLEMENTAL_MODERNITY_CHECKS: Array<{
  id: string;
  pattern: RegExp;
  skipWhen: RegExp;
  guides: string[];
  message: string;
  fix: string;
}> = [
  {
    id: 'MWG-TOOLTIP-POS',
    pattern:
      /getBoundingClientRect\s*\(\s*\)[\s\S]{0,450}?(?:addEventListener\s*\(\s*['"](?:scroll|resize)['"]|\b(?:onScroll|innerHeight|innerWidth|clientHeight|clientWidth|scrollY|pageYOffset)\b)|(?:addEventListener\s*\(\s*['"](?:scroll|resize)['"]|\bonScroll\b)[\s\S]{0,450}?getBoundingClientRect\s*\(\s*\)/i,
    skipWhen:
      /\b(?:position-anchor|anchor-name|position-area|position-try-fallbacks|positionAnchor|anchorName|positionArea)\b/,
    guides: ['position-aware-tooltips', 'interest-triggered-tooltips'],
    message: 'Manual getBoundingClientRect() + scroll/viewport positioning.',
    fix: 'Use native `[popover]` (`popover="hint"` / `interestfor` for tooltips) + CSS Anchor Positioning (`anchor-name`, `position-area`, `position-try-fallbacks`).',
  },
  {
    id: 'MWG-CLIPBOARD-EXECCOMMAND',
    pattern: /\bdocument\.execCommand\s*\(\s*['"](?:copy|cut|paste|insertText)['"]/i,
    skipWhen: /\bnavigator\.clipboard\b/,
    guides: ['copy-button'],
    message: 'Deprecated synchronous `document.execCommand()` clipboard workaround.',
    fix: 'Use asynchronous `await navigator.clipboard.writeText(...)` instead of `document.execCommand("copy")`.',
  },
  {
    id: 'MWG-LEGACY-100VH',
    pattern: /(?<![\w-])(?:min-|max-)?(?:height|block-size)\s*:\s*100vh\b/i,
    skipWhen:
      /\b100(?:dvh|svh|lvh)\b|\bscroll-snap-type\s*:|\bcontainer-type\s*:\s*scroll-state\b/i,
    guides: ['css-layout', 'responsive-design'],
    message: 'Static `100vh` layout clips beneath mobile dynamic browser toolbars.',
    fix: 'Use dynamic viewport units (`100dvh` or `100svh`) instead of `100vh`.',
  },
];

export interface StaticPassResult {
  durationMs: number;
  scannedFilesCount: number;
  legacyScanAvailable: boolean;
  matchedGuides: string[];
  findings: VerificationFinding[];
}

export async function runStaticPass(
  workspaceDir: string,
  touchedFiles: readonly string[],
  project: ProjectConfig,
): Promise<StaticPassResult> {
  const startedAt = performance.now();
  const guideSet = getVerifiedMwgGuideSet();

  const fileRecords: FileRecord[] = [];
  for (const relPath of touchedFiles) {
    const absPath = path.join(workspaceDir, relPath);
    if (!existsSync(absPath)) continue;
    let raw: string;
    try {
      raw = readFileSync(absPath, 'utf8').slice(0, MAX_SCAN_CHARS_PER_FILE);
    } catch {
      continue;
    }
    const ext = path.extname(relPath).toLowerCase();
    const stripped = stripCommentsPreservingLines(raw, ext);
    fileRecords.push({
      relPath,
      raw,
      stripped,
    });
  }

  const findings: VerificationFinding[] = [];
  const seenKeys = new Set<string>();
  const coveredFileGuides = new Set<string>();

  // 1. Run `modern-web-guidance`'s native `legacy-scan` analyzer in-process.
  const legacyScan = await scanTouchedFilesWithLegacyScan(workspaceDir, touchedFiles);
  for (const f of legacyScan.findings) {
    const validGuides = filterVerifiedGuides(f.guides, guideSet);
    const key = `${f.file}:${f.line}:${f.ruleId}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    for (const g of validGuides) coveredFileGuides.add(`${f.file}:${g}`);
    findings.push({ ...f, guides: validGuides });
  }

  // 2. Run supplemental checks for topics not yet covered by `legacy-scan`.
  for (const rec of fileRecords) {
    for (const check of SUPPLEMENTAL_MODERNITY_CHECKS) {
      const validGuides = filterVerifiedGuides(check.guides, guideSet);
      if (validGuides.some((g) => coveredFileGuides.has(`${rec.relPath}:${g}`))) continue;
      if (check.skipWhen.test(rec.stripped)) continue;
      const m = check.pattern.exec(rec.stripped);
      if (!m) continue;
      const line = lineNumberAt(rec.stripped, m.index);
      const key = `${rec.relPath}:${line}:${check.id}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      for (const g of validGuides) coveredFileGuides.add(`${rec.relPath}:${g}`);
      findings.push({
        category: 'MODERNITY',
        severity: 'warning',
        file: rec.relPath,
        line,
        ruleId: check.id,
        message: check.message,
        guides: validGuides,
        fix: check.fix,
      });
    }
  }

  // 3. Evaluate opinionated Vertical Pack static rules (`commerce` | `media` | `saas`) if active.
  if (project.pack) {
    for (const f of runStaticPackChecks(project.pack, fileRecords, guideSet)) {
      const key = `${f.file}:${f.line}:${f.ruleId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        findings.push(f);
      }
    }
  }

  // 4. Run the project's own ESLint flat configuration if present in the workspace.
  for (const f of await runWorkspaceEslintIfConfigured(workspaceDir, touchedFiles, project)) {
    f.guides = filterVerifiedGuides(f.guides, guideSet);
    const key = `${f.file}:${f.line}:${f.ruleId}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      findings.push(f);
    }
  }

  return {
    durationMs: Math.round(performance.now() - startedAt),
    scannedFilesCount: fileRecords.length,
    legacyScanAvailable: legacyScan.available,
    matchedGuides: legacyScan.matchedGuides,
    findings,
  };
}
