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

import type { FindingCategory, VerificationFinding, VerificationReport } from './types.ts';

const CATEGORY_ORDER: Record<FindingCategory, number> = {
  RUNTIME: 0,
  A11Y: 1,
  SMOKE: 2,
  'PACK:COMMERCE': 3,
  'PACK:MEDIA': 3,
  'PACK:SAAS': 3,
  PERF: 4,
  MODERNITY: 5,
};

function formatLocation(finding: VerificationFinding): string {
  const fileLoc = finding.file
    ? finding.line
      ? `${finding.file}:${finding.line}`
      : finding.file
    : null;

  if (finding.route && fileLoc) {
    return `${finding.route} (${fileLoc})`;
  }
  if (finding.route) {
    return finding.route;
  }
  if (fileLoc) {
    return fileLoc;
  }
  return 'workspace';
}

function formatGuideFixLine(finding: VerificationFinding): string | null {
  const guides = Array.isArray(finding.guides) ? finding.guides.filter(Boolean) : [];
  if (guides.length > 0) {
    const guideList = guides.map((g) => `\`${g}\``).join(' + ');
    const retrieveArg = guides.join(',');
    const detail = finding.fix ? ` (${finding.fix})` : '';
    return `→ Fix: Retrieve & apply MWG guide ${guideList} via \`npx -y modern-web-guidance@latest retrieve "${retrieveArg}"\`${detail}`;
  }
  if (finding.fix) {
    return `→ Fix: ${finding.fix}`;
  }
  return null;
}

export function sortAndBudgetFindings(
  findings: readonly VerificationFinding[],
  maxFindings = 20,
): { displayed: VerificationFinding[]; omittedCount: number } {
  const sorted = [...findings].sort((a, b) => {
    const sevDiff = (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1);
    if (sevDiff !== 0) return sevDiff;
    const catDiff = (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9);
    if (catDiff !== 0) return catDiff;
    return (a.file || a.route || '').localeCompare(b.file || b.route || '');
  });

  return {
    displayed: sorted.slice(0, maxFindings),
    omittedCount: Math.max(0, sorted.length - maxFindings),
  };
}

export function formatVerificationReport(
  report: Omit<VerificationReport, 'formatted'>,
  options: { maxFindings?: number } = {},
): string {
  const { displayed, omittedCount } = sortAndBudgetFindings(
    report.findings,
    options.maxFindings ?? 20,
  );

  const routesStr = report.routes.join(', ');
  const packSegment = report.pack ? ` | pack: ${report.pack}` : '';
  const headerStatus = report.passed ? '✅ PASS' : '❌ FAIL';
  const lines = [
    `${headerStatus} modern-web-guidance verify (${report.durationMs}ms | ${report.frameworkName}${packSegment} | routes: ${routesStr} | touched: ${report.touchedFiles.length} file(s))`,
  ];

  if (report.infraWarning) {
    const infraIcon = report.infraFailed ? '❌' : '⚠️';
    lines.push(`${infraIcon} [INFRA] ${report.infraWarning}`);
    if (report.infraFailed) {
      lines.push(
        '→ Fix: Ensure the dev server starts cleanly (`npm run dev`) without syntax/startup errors or pass a reachable `--url`.',
      );
    }
  }

  if (displayed.length === 0 && report.passed) {
    if (report.passes.browser) {
      const segments = [
        '✓ Runtime & Hydration (0 errors)',
        '✓ Accessibility WCAG 2.2 AA',
        '✓ Modernity & Lint (0 issues)',
        '✓ Smoke Probe',
      ];
      if (report.pack) {
        segments.push(`✓ Pack:${report.pack}`);
      }
      if (report.passes.perf) {
        const p = report.passes.perf;
        segments.push(`✓ Perf (CLS ${p.maxCls}, LoAF ${p.maxLoafMs}ms, DOM ${p.maxDomNodes})`);
      }
      lines.push(segments.join(' | '));
    } else {
      lines.push('✓ Modernity & Lint (0 issues) | Browser passes skipped');
    }
    return lines.join('\n');
  }

  if (displayed.length > 0) {
    lines.push('');
  }
  for (const finding of displayed) {
    const icon = finding.severity === 'error' ? '❌' : '⚠️';
    const loc = formatLocation(finding);
    lines.push(`${icon} [${finding.category}] ${loc}: ${finding.message}`);
    const fixLine = formatGuideFixLine(finding);
    if (fixLine) {
      lines.push(fixLine);
    }
  }

  if (omittedCount > 0) {
    lines.push(`\n… +${omittedCount} additional finding(s) omitted to preserve context window.`);
  }

  return lines.join('\n');
}
