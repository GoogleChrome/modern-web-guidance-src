/* oxlint-disable max-lines-per-function */
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, styleText } from 'node:util';
import {
  ALL_RULES,
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_RULES,
} from './rules/index.ts';
import { scanRepoFiles } from './scanners/index.ts';
import type { AnalyzerFinding, AnalyzerRule, VerifierRubric } from './schema.ts';

export type GuideConfidenceTier = 'qualified' | 'experimental';

export function getGuideConfidenceTier(guideId: string): GuideConfidenceTier {
  if (QUALIFIED_GUIDE_IDS.includes(guideId)) return 'qualified';
  return 'experimental';
}

export interface AnalyzeCliFinding {
  readonly ruleId: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly codeSnippet: string;
  readonly summary?: string;
  readonly verifierRubric?: VerifierRubric;
}

export interface AnalyzeCliRuleGroup {
  readonly ruleId: string;
  readonly summary: string;
  readonly verifierRubric?: VerifierRubric;
  readonly count: number;
  readonly findings: readonly AnalyzeCliFinding[];
}

export interface AnalyzeCliGuideGroup {
  readonly guideId: string;
  readonly tier: GuideConfidenceTier;
  readonly summary: string;
  readonly retrieveCommand: string;
  readonly verifierRubric?: VerifierRubric;
  readonly count: number;
  readonly findings: readonly AnalyzeCliFinding[];
  readonly rules?: readonly AnalyzeCliRuleGroup[];
}

export interface AnalyzeJsonOutput {
  readonly targetDir: string;
  readonly totalFindings: number;
  readonly guides: readonly AnalyzeCliGuideGroup[];
  readonly activeRuleCount?: number;
  readonly activeGuideCount?: number;
  readonly statusNotice?: string;
  readonly error?: string;
  readonly skippedDocsAndTestsCount?: number;
}

export interface AnalyzeCliExecutionOptions {
  readonly rules?: readonly AnalyzerRule[];
  readonly cwd?: string;
  readonly maxFiles?: number;
}

export interface AnalyzeCliResult {
  readonly exitCode: number;
  readonly output: string;
  readonly data?: AnalyzeJsonOutput;
}

export interface FormatHumanReadableOptions {
  readonly activeRuleCount?: number;
  readonly activeGuideCount?: number;
  readonly isDefaultQualifiedMode?: boolean;
  readonly color?: boolean;
  readonly skippedDocsAndTestsCount?: number;
}

export type TextStyle = Parameters<typeof styleText>[0];

export function shouldEnableColor(optionsColor?: boolean): boolean {
  if (optionsColor !== undefined) return optionsColor;
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false;
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== '0') return true;
  return Boolean(process.stdout?.isTTY);
}

export function elideText(text: string, maxLen = 110): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLen) {
    return normalized;
  }
  return normalized.slice(0, maxLen - 1).trimEnd() + '…';
}

export function extractTargetCodeLine(codeSnippet: string, maxLen = 80): string {
  if (!codeSnippet) return '';
  const lines = codeSnippet.split('\n');
  const markedLine = lines.find((l) => l.trimStart().startsWith('>'));
  let target = markedLine ?? lines.find((l) => l.trim().length > 0) ?? '';
  target = target.replace(/^\s*>\s*(?:\d+\s*\|\s*)?/, '');
  if (!markedLine) {
    target = target.replace(/^\s*\d+\s*\|\s*/, '');
  }
  target = target.trim().replace(/\s+/g, ' ');
  return elideText(target, maxLen);
}

export function sampleDiversifiedFindings(
  findings: readonly AnalyzeCliFinding[],
  maxTotal = 5,
  maxPerFileInitial = 2,
): AnalyzeCliFinding[] {
  if (findings.length <= maxTotal) {
    return [...findings];
  }
  const byFile = new Map<string, AnalyzeCliFinding[]>();
  for (const f of findings) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }
  const sampled: AnalyzeCliFinding[] = [];
  const fileEntries = Array.from(byFile.values());
  const fileIndices = new Map<AnalyzeCliFinding[], number>();

  // Pass 1: Round-robin up to maxPerFileInitial per file
  for (let round = 0; round < maxPerFileInitial; round++) {
    for (const list of fileEntries) {
      const idx = fileIndices.get(list) ?? 0;
      if (idx < list.length) {
        sampled.push(list[idx]);
        fileIndices.set(list, idx + 1);
        if (sampled.length >= maxTotal) return sampled;
      }
    }
  }

  // Pass 2: If still under maxTotal, fill from remaining findings
  while (sampled.length < maxTotal) {
    let addedAny = false;
    for (const list of fileEntries) {
      const idx = fileIndices.get(list) ?? 0;
      if (idx < list.length) {
        sampled.push(list[idx]);
        fileIndices.set(list, idx + 1);
        addedAny = true;
        if (sampled.length >= maxTotal) return sampled;
      }
    }
    if (!addedAny) break;
  }

  return sampled;
}

export const ANALYZE_CLI_HELP = `
Usage: modern-web-guidance analyze <dir> [options]

Analyze a codebase for legacy web platform patterns to detect modernization opportunities.

Arguments:
  <dir>                     Directory to analyze (defaults to current directory)

Options:
  --json                    Output findings as structured JSON for coding agents
  --guide <guideId>         Filter analysis to a specific guide ID
  --experimental            Include all experimental rules (alias: --all-rules)
  --include-docs-and-tests  Include documentation, example, demo, and test files in analysis
  -h, --help                Show this help message
`.trim();

export function buildQualificationStatusNotice(
  activeRuleCount: number,
  _activeGuideCount?: number,
): string | undefined {
  if (activeRuleCount === 0) {
    return `0 qualified rules are currently configured for default scanning; pass --experimental (or --all-rules) for experimental findings.`;
  }
  return undefined;
}

/**
 * Formats findings into human-readable terminal output.
 * Renders modern styled header, provisional verification notice, visible keepWhen / dropWhen rubric lines,
 * file-diversified findings list with code preview (up to 5 findings per guide, max 2 per file first),
 * and single bottom footer.
 */
export function formatHumanReadable(
  targetDir: string,
  totalFindings: number,
  guides: readonly AnalyzeCliGuideGroup[],
  guideFilter?: string,
  formatOptions?: FormatHumanReadableOptions,
): string {
  const isDefaultMode = formatOptions?.isDefaultQualifiedMode ?? false;
  const activeRuleCount = formatOptions?.activeRuleCount;
  const activeGuideCount = formatOptions?.activeGuideCount ?? 0;
  const skippedDocsAndTestsCount = formatOptions?.skippedDocsAndTestsCount ?? 0;
  const colorEnabled = shouldEnableColor(formatOptions?.color);

  const prevForce = process.env.FORCE_COLOR;
  const prevNoColor = process.env.NO_COLOR;
  if (colorEnabled) {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = '1';
  }

  const fmt = (style: TextStyle, text: string): string => {
    if (!colorEnabled) return text;
    return styleText(style, text);
  };

  try {
    if (totalFindings === 0) {
      if (isDefaultMode && activeRuleCount === 0) {
        return [
          `${fmt('bold', 'Modern Web Guidance Analyzer')} — ${targetDir}`,
          `0 qualified rules are currently configured for default scanning.`,
          `Pass --experimental (or --all-rules) for experimental findings across ${ALL_RULES.length} rules.`,
          '',
        ].join('\n');
      }
      if (isDefaultMode) {
        const lines = [
          `${fmt('bold', 'Modern Web Guidance Analyzer')} — ${targetDir}`,
          `0 findings from ${activeGuideCount} qualified ${activeGuideCount === 1 ? 'guide' : 'guides'} (pass --experimental to include experimental guides).`,
        ];
        if (skippedDocsAndTestsCount > 0) {
          lines.push(
            fmt(
              'dim',
              `Skipped ${skippedDocsAndTestsCount} docs and test ${skippedDocsAndTestsCount === 1 ? 'file' : 'files'} (pass --include-docs-and-tests to scan).`,
            ),
          );
        }
        lines.push('');
        return lines.join('\n');
      }
      const filterNote = guideFilter ? ` for guide "${guideFilter}"` : '';
      const lines: string[] = [];
      if (skippedDocsAndTestsCount > 0) {
        lines.push(
          fmt(
            'dim',
            `Skipped ${skippedDocsAndTestsCount} docs and test ${skippedDocsAndTestsCount === 1 ? 'file' : 'files'} (pass --include-docs-and-tests to scan).`,
          ),
        );
      }
      lines.push(`No modernization opportunities found in ${targetDir}${filterNote}.\n`);
      return lines.join('\n');
    }

    const lines: string[] = [
      `${fmt('bold', 'Modern Web Guidance Analyzer')} — ${targetDir}`,
      `Found ${fmt('bold', String(totalFindings))} modernization ${totalFindings === 1 ? 'opportunity' : 'opportunities'} across ${fmt('bold', String(guides.length))} ${guides.length === 1 ? 'guide' : 'guides'}:`,
      fmt('dim', 'Note: Static analysis results are provisional — verify against the Keep/Drop criteria below.'),
    ];

    if (skippedDocsAndTestsCount > 0) {
      lines.push(
        fmt(
          'dim',
          `Skipped ${skippedDocsAndTestsCount} docs and test ${skippedDocsAndTestsCount === 1 ? 'file' : 'files'} (pass --include-docs-and-tests to scan).`,
        ),
      );
    }
    lines.push('');

    for (const g of guides) {
      const hasMultipleRules = Boolean(g.rules && g.rules.length > 1);
      const tierBadge =
        g.tier === 'experimental'
          ? ` ${fmt('yellow', '[experimental]')}`
          : ` ${fmt('dim', '[qualified]')}`;

      if (!hasMultipleRules) {
        lines.push(
          `* ${fmt(['bold', 'cyan'], g.guideId)}${tierBadge} ${fmt('dim', `(${g.count} finding${g.count === 1 ? '' : 's'})`)}`,
        );
        lines.push(`  ${g.summary}`);

        if (g.verifierRubric) {
          const keepRaw = Array.isArray(g.verifierRubric.keepWhen)
            ? g.verifierRubric.keepWhen.join('; ')
            : String(g.verifierRubric.keepWhen);
          const dropRaw = Array.isArray(g.verifierRubric.dropWhen)
            ? g.verifierRubric.dropWhen.join('; ')
            : String(g.verifierRubric.dropWhen);
          lines.push(`  ${fmt('dim', `Keep when: ${elideText(keepRaw, 110)}`)}`);
          lines.push(`  ${fmt('dim', `Drop when: ${elideText(dropRaw, 110)}`)}`);
        }

        const displayedFindings = sampleDiversifiedFindings(g.findings, 5, 2);
        for (const f of displayedFindings) {
          lines.push(`  - ${f.file}:${f.line}`);
          const codePreview = extractTargetCodeLine(f.codeSnippet, 80);
          if (codePreview) {
            lines.push(`    ${fmt('dim', codePreview)}`);
          }
        }

        if (g.findings.length > displayedFindings.length) {
          const remaining = g.findings.length - displayedFindings.length;
          lines.push(`  ... and ${remaining} more finding${remaining === 1 ? '' : 's'}`);
        }

        lines.push('');
      } else {
        const ruleCount = g.rules!.length;
        lines.push(
          `* ${fmt(['bold', 'cyan'], g.guideId)}${tierBadge} ${fmt('dim', `(${g.count} finding${g.count === 1 ? '' : 's'} across ${ruleCount} rules)`)}`,
        );

        for (const rg of g.rules!) {
          lines.push('');
          lines.push(
            `  ${fmt('bold', rg.ruleId)} ${fmt('dim', `(${rg.count} finding${rg.count === 1 ? '' : 's'})`)}`,
          );
          lines.push(`    ${rg.summary}`);

          if (rg.verifierRubric) {
            const keepRaw = Array.isArray(rg.verifierRubric.keepWhen)
              ? rg.verifierRubric.keepWhen.join('; ')
              : String(rg.verifierRubric.keepWhen);
            const dropRaw = Array.isArray(rg.verifierRubric.dropWhen)
              ? rg.verifierRubric.dropWhen.join('; ')
              : String(rg.verifierRubric.dropWhen);
            lines.push(`    ${fmt('dim', `Keep when: ${elideText(keepRaw, 110)}`)}`);
            lines.push(`    ${fmt('dim', `Drop when: ${elideText(dropRaw, 110)}`)}`);
          }

          const displayedFindings = sampleDiversifiedFindings(rg.findings, 5, 2);
          for (const f of displayedFindings) {
            lines.push(`    - ${f.file}:${f.line}`);
            const codePreview = extractTargetCodeLine(f.codeSnippet, 80);
            if (codePreview) {
              lines.push(`      ${fmt('dim', codePreview)}`);
            }
          }

          if (rg.findings.length > displayedFindings.length) {
            const remaining = rg.findings.length - displayedFindings.length;
            lines.push(`    ... and ${remaining} more finding${remaining === 1 ? '' : 's'}`);
          }
        }

        lines.push('');
      }
    }

    lines.push(
      `Retrieve a guide: ${fmt('cyan', 'npx modern-web-guidance retrieve <guide-id>')} (or pass ${fmt('cyan', '--json')} for coding agents)`,
    );

    return lines.join('\n').trimEnd() + '\n';
  } finally {
    if (colorEnabled) {
      if (prevForce === undefined) delete process.env.FORCE_COLOR;
      else process.env.FORCE_COLOR = prevForce;
      if (prevNoColor !== undefined) process.env.NO_COLOR = prevNoColor;
    }
  }
}

/**
 * Deterministic CLI runner for modern-web-guidance analyze.
 * Supports human-readable output, --json structured output, and --guide filtering.
 */
export async function runAnalyzeCli(
  args: readonly string[],
  options?: AnalyzeCliExecutionOptions,
): Promise<AnalyzeCliResult> {
  const cleanArgs = args[0] === 'analyze' ? args.slice(1) : args;

  const parsed = parseArgs({
    args: [...cleanArgs],
    options: {
      json: { type: 'boolean' },
      guide: { type: 'string' },
      'all-rules': { type: 'boolean' },
      experimental: { type: 'boolean' },
      'include-docs-and-tests': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: false,
  });

  const isJson = Boolean(parsed.values.json);
  const guideFilter = typeof parsed.values.guide === 'string' ? parsed.values.guide : undefined;
  const isHelp = Boolean(parsed.values.help);
  const useAllRules = Boolean(parsed.values['all-rules'] || parsed.values.experimental);
  const includeDocsAndTests = Boolean(parsed.values['include-docs-and-tests']);
  const targetDir = parsed.positionals[0] || '.';

  if (isHelp) {
    return {
      exitCode: 0,
      output: ANALYZE_CLI_HELP + '\n',
    };
  }

  const baseCwd = options?.cwd ?? process.cwd();
  const resolvedDir = resolve(baseCwd, targetDir);

  try {
    const s = await stat(resolvedDir);
    if (!s.isDirectory()) {
      const err = `Target path is not a directory: ${targetDir}`;
      if (isJson) {
        const data: AnalyzeJsonOutput = { targetDir, totalFindings: 0, guides: [], error: err };
        return { exitCode: 1, output: JSON.stringify(data, null, 2) + '\n', data };
      }
      return { exitCode: 1, output: `Error: ${err}\n` };
    }
  } catch {
    const err = `Target directory not found: ${targetDir}`;
    if (isJson) {
      const data: AnalyzeJsonOutput = { targetDir, totalFindings: 0, guides: [], error: err };
      return { exitCode: 1, output: JSON.stringify(data, null, 2) + '\n', data };
    }
    return { exitCode: 1, output: `Error: ${err}\n` };
  }

  const isDefaultQualifiedMode =
    !useAllRules && !guideFilter && options?.rules === undefined;
  const defaultRules =
    useAllRules || Boolean(guideFilter)
      ? ALL_RULES
      : QUALIFIED_RULES;
  const activeRulesList = options?.rules ?? defaultRules;
  const activeRules = guideFilter
    ? activeRulesList.filter((r) => r.guideId === guideFilter)
    : activeRulesList;

  const activeRuleCount = activeRules.length;
  const activeGuideIds = new Set(activeRules.map((r) => r.guideId));
  const activeGuideCount = activeGuideIds.size;
  const statusNotice = isDefaultQualifiedMode
    ? buildQualificationStatusNotice(activeRuleCount, activeGuideCount)
    : undefined;

  const scanStats = { skippedDocsAndTestsCount: 0 };
  const findings =
    activeRuleCount > 0
      ? await scanRepoFiles(resolvedDir, activeRules, {
          maxFiles: options?.maxFiles,
          includeDocsAndTests,
          stats: scanStats,
        })
      : [];
  const skippedDocsAndTestsCount = scanStats.skippedDocsAndTestsCount;

  const findingsByGuide = new Map<string, AnalyzerFinding[]>();
  for (const f of findings) {
    const list = findingsByGuide.get(f.guideId) ?? [];
    list.push(f);
    findingsByGuide.set(f.guideId, list);
  }

  const ruleMap = new Map<string, AnalyzerRule>();
  for (const r of ALL_RULES) {
    ruleMap.set(r.id, r);
  }
  if (options?.rules) {
    for (const r of options.rules) {
      ruleMap.set(r.id, r);
    }
  }

  const sortedGuideIds = Array.from(findingsByGuide.keys()).sort();

  const guides: AnalyzeCliGuideGroup[] = sortedGuideIds.map((gid) => {
    const guideFindings = findingsByGuide.get(gid) ?? [];
    guideFindings.sort((a, b) => {
      const cmpFile = a.file.localeCompare(b.file);
      if (cmpFile !== 0) return cmpFile;
      if (a.line !== b.line) return a.line - b.line;
      return a.ruleId.localeCompare(b.ruleId);
    });

    const ruleIdsInFindings = Array.from(new Set(guideFindings.map((f) => f.ruleId))).sort();

    const ruleGroups: AnalyzeCliRuleGroup[] = ruleIdsInFindings.map((rid) => {
      const rule = ruleMap.get(rid);
      if (!rule) {
        throw new Error(`Rule definition not found for ruleId "${rid}" (guide "${gid}")`);
      }
      if (!rule.summary || !rule.summary.trim()) {
        throw new Error(`Rule "${rule.id}" is missing a required summary string`);
      }
      const rf = guideFindings.filter((f) => f.ruleId === rid);
      return {
        ruleId: rid,
        summary: rule.summary,
        ...(rule.verifierRubric ? { verifierRubric: rule.verifierRubric } : {}),
        count: rf.length,
        findings: rf.map((f) => ({
          ruleId: f.ruleId,
          file: f.file,
          line: f.line,
          message: f.message,
          codeSnippet: f.codeSnippet || f.contextSlice,
          summary: rule.summary,
          ...(rule.verifierRubric ? { verifierRubric: rule.verifierRubric } : {}),
        })),
      };
    });

    const tier = getGuideConfidenceTier(gid);
    const isSingleRule = ruleGroups.length === 1;
    const primaryRule = ruleGroups[0];
    if (!primaryRule) {
      throw new Error(`No rules with findings found for guide "${gid}"`);
    }

    const summary = isSingleRule
      ? primaryRule.summary
      : ruleGroups.map((rg) => rg.summary).join('; ');
    const verifierRubric = isSingleRule ? primaryRule.verifierRubric : undefined;

    return {
      guideId: gid,
      tier,
      summary,
      retrieveCommand: `npx modern-web-guidance retrieve ${gid}`,
      ...(verifierRubric ? { verifierRubric } : {}),
      count: guideFindings.length,
      findings: guideFindings.map((f) => {
        const rule = ruleMap.get(f.ruleId);
        if (!rule) {
          throw new Error(`Rule definition not found for ruleId "${f.ruleId}" (guide "${gid}")`);
        }
        if (!rule.summary || !rule.summary.trim()) {
          throw new Error(`Rule "${rule.id}" is missing a required summary string`);
        }
        return {
          ruleId: f.ruleId,
          file: f.file,
          line: f.line,
          message: f.message,
          codeSnippet: f.codeSnippet || f.contextSlice,
          summary: rule.summary,
          ...(rule.verifierRubric ? { verifierRubric: rule.verifierRubric } : {}),
        };
      }),
      ...(ruleGroups.length > 1 ? { rules: ruleGroups } : {}),
    };
  });

  const totalFindings = findings.length;
  const data: AnalyzeJsonOutput = {
    targetDir,
    totalFindings,
    guides,
    activeRuleCount,
    activeGuideCount,
    ...(statusNotice ? { statusNotice } : {}),
    ...(skippedDocsAndTestsCount > 0 ? { skippedDocsAndTestsCount } : {}),
  };

  if (isJson) {
    return {
      exitCode: 0,
      output: JSON.stringify(data, null, 2) + '\n',
      data,
    };
  }

  const output = formatHumanReadable(targetDir, totalFindings, guides, guideFilter, {
    activeRuleCount,
    activeGuideCount,
    isDefaultQualifiedMode,
    skippedDocsAndTestsCount,
  });
  return { exitCode: 0, output, data };
}

const isMainModule =
  Boolean(import.meta.main) ||
  (Boolean(process.argv[1]) &&
    (process.argv[1].endsWith('cli.ts') ||
      process.argv[1].endsWith('analyze.mjs') ||
      (typeof import.meta.url === 'string' &&
        process.argv[1] === fileURLToPath(import.meta.url))));

if (isMainModule) {
  runAnalyzeCli(process.argv.slice(2))
    .then((result) => {
      if (result.exitCode === 0 || result.data !== undefined) {
        process.stdout.write(result.output);
      } else {
        process.stderr.write(result.output);
      }
      process.exitCode = result.exitCode;
    })
    .catch((err: unknown) => {
      console.error('Modern Web Guidance Analyzer error:', err);
      process.exitCode = 1;
    });
}
