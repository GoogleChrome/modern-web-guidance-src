import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, styleText } from 'node:util';
import {
  ALL_RULES,
  QUALIFIED_RULES,
  RULE_REGISTRY_BY_GUIDE_ID,
} from './rules/index.ts';
import { scanRepoFiles } from './scanners/index.ts';
import type { AnalyzerRule, VerifierRubric } from './schema.ts';

export type GuideConfidenceTier = 'qualified' | 'experimental';

export function getGuideConfidenceTier(guideId: string): GuideConfidenceTier {
  return RULE_REGISTRY_BY_GUIDE_ID.get(guideId)?.lifecycle.status === 'qualified'
    ? 'qualified'
    : 'experimental';
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
  const raw =
    lines.find((l) => l.trimStart().startsWith('>')) ??
    lines.find((l) => l.trim().length > 0) ??
    '';
  return elideText(raw.replace(/^\s*>?\s*(?:\d+\s*\|\s*)?/, ''), maxLen);
}

export function sampleDiversifiedFindings(
  findings: readonly AnalyzeCliFinding[],
  maxTotal = 5,
): AnalyzeCliFinding[] {
  if (findings.length <= maxTotal) return [...findings];
  const fileLists = Array.from(Map.groupBy(findings, (f) => f.file).values());
  const sampled: AnalyzeCliFinding[] = [];
  for (let round = 0; sampled.length < maxTotal; round++) {
    for (const list of fileLists) {
      if (round < list.length) {
        sampled.push(list[round]!);
        if (sampled.length === maxTotal) return sampled;
      }
    }
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
  --all                     Include all experimental rules
  --include-docs-and-tests  Include documentation, example, demo, and test files in analysis
  -h, --help                Show this help message
`.trim();

function appendFindingGroupBlock(
  lines: string[],
  group: {
    readonly summary: string;
    readonly verifierRubric?: VerifierRubric;
    readonly findings: readonly AnalyzeCliFinding[];
  },
  indent: string,
  fmt: (style: TextStyle, text: string) => string,
): void {
  lines.push(`${indent}${group.summary}`);
  if (group.verifierRubric) {
    const keep = elideText(group.verifierRubric.keepWhen.join('; '), 110);
    const drop = elideText(group.verifierRubric.dropWhen.join('; '), 110);
    lines.push(`${indent}${fmt('dim', `Keep when: ${keep}`)}`);
    lines.push(`${indent}${fmt('dim', `Drop when: ${drop}`)}`);
  }
  const displayed = sampleDiversifiedFindings(group.findings, 5);
  for (const f of displayed) {
    lines.push(`${indent}- ${f.file}:${f.line}`);
    const preview = extractTargetCodeLine(f.codeSnippet, 80);
    if (preview) {
      lines.push(`${indent}  ${fmt('dim', preview)}`);
    }
  }
  const remaining = group.findings.length - displayed.length;
  if (remaining > 0) {
    lines.push(`${indent}... and ${remaining} more finding${remaining === 1 ? '' : 's'}`);
  }
}

/**
 * Formats findings into human-readable terminal output.
 * Renders modern styled header, provisional verification notice, visible keepWhen / dropWhen rubric lines,
 * file-diversified findings list with code preview (up to 5 findings per guide),
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
  const activeGuideCount = formatOptions?.activeGuideCount ?? 0;
  const skippedDocsAndTestsCount = formatOptions?.skippedDocsAndTestsCount ?? 0;
  const colorEnabled = shouldEnableColor(formatOptions?.color);

  const fmt = (style: TextStyle, text: string): string =>
    colorEnabled ? styleText(style, text, { validateStream: false }) : text;

  const skippedNotice =
    skippedDocsAndTestsCount > 0
      ? fmt(
          'dim',
          `Skipped ${skippedDocsAndTestsCount} docs and test ${skippedDocsAndTestsCount === 1 ? 'file' : 'files'} (pass --include-docs-and-tests to scan).`,
        )
      : undefined;

  if (totalFindings === 0) {
    if (isDefaultMode) {
      const lines = [
        `${fmt('bold', 'Modern Web Guidance Analyzer')} — ${targetDir}`,
        `0 findings from ${activeGuideCount} qualified ${activeGuideCount === 1 ? 'guide' : 'guides'} (pass --all to include experimental guides).`,
      ];
      if (skippedNotice) lines.push(skippedNotice);
      lines.push('');
      return lines.join('\n');
    }
    const filterNote = guideFilter ? ` for guide "${guideFilter}"` : '';
    const lines: string[] = [];
    if (skippedNotice) lines.push(skippedNotice);
    lines.push(`No modernization opportunities found in ${targetDir}${filterNote}.\n`);
    return lines.join('\n');
  }

  const lines: string[] = [
    `${fmt('bold', 'Modern Web Guidance Analyzer')} — ${targetDir}`,
    `Found ${fmt('bold', String(totalFindings))} modernization ${totalFindings === 1 ? 'opportunity' : 'opportunities'} across ${fmt('bold', String(guides.length))} ${guides.length === 1 ? 'guide' : 'guides'}:`,
    fmt('dim', 'Note: Static analysis results are provisional — verify against the Keep/Drop criteria below.'),
  ];
  if (skippedNotice) lines.push(skippedNotice);
  lines.push('');

  for (const g of guides) {
    const tierBadge =
      g.tier === 'experimental'
        ? ` ${fmt('yellow', '[experimental]')}`
        : ` ${fmt('dim', '[qualified]')}`;

    if (!g.rules || g.rules.length <= 1) {
      lines.push(
        `* ${fmt(['bold', 'cyan'], g.guideId)}${tierBadge} ${fmt('dim', `(${g.count} finding${g.count === 1 ? '' : 's'})`)}`,
      );
      appendFindingGroupBlock(lines, g, '  ', fmt);
      lines.push('');
    } else {
      lines.push(
        `* ${fmt(['bold', 'cyan'], g.guideId)}${tierBadge} ${fmt('dim', `(${g.count} finding${g.count === 1 ? '' : 's'} across ${g.rules.length} rules)`)}`,
      );
      for (const rg of g.rules) {
        lines.push('');
        lines.push(
          `  ${fmt('bold', rg.ruleId)} ${fmt('dim', `(${rg.count} finding${rg.count === 1 ? '' : 's'})`)}`,
        );
        appendFindingGroupBlock(lines, rg, '    ', fmt);
      }
      lines.push('');
    }
  }

  lines.push(
    `Retrieve a guide: ${fmt('cyan', 'npx modern-web-guidance retrieve <guide-id>')} (or pass ${fmt('cyan', '--json')} for coding agents)`,
  );

  return lines.join('\n').trimEnd() + '\n';
}

function errorCliResult(error: string, isJson: boolean, targetDir = '.'): AnalyzeCliResult {
  if (isJson) {
    const data: AnalyzeJsonOutput = { targetDir, totalFindings: 0, guides: [], error };
    return { exitCode: 1, output: JSON.stringify(data, null, 2) + '\n', data };
  }
  return { exitCode: 1, output: `Error: ${error}\n` };
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

  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...cleanArgs],
      options: {
        json: { type: 'boolean' },
        guide: { type: 'string' },
        all: { type: 'boolean' },
        'include-docs-and-tests': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const retiredMatch = rawMsg.match(/Unknown option '(--(?:experimental|all-rules))'/);
    const error = retiredMatch ? `${retiredMatch[1]} was renamed to --all` : rawMsg;
    const isJson = cleanArgs.includes('--json');
    const targetDir = cleanArgs.find((a) => !a.startsWith('-')) || '.';
    return errorCliResult(error, isJson, targetDir);
  }

  const isJson = Boolean(parsed.values.json);
  const guideFilter = typeof parsed.values.guide === 'string' ? parsed.values.guide : undefined;
  const isHelp = Boolean(parsed.values.help);
  const useAllRules = Boolean(parsed.values.all);
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

  const dirStat = await stat(resolvedDir).catch(() => null);
  if (!dirStat?.isDirectory()) {
    const error = dirStat
      ? `Target path is not a directory: ${targetDir}`
      : `Target directory not found: ${targetDir}`;
    return errorCliResult(error, isJson, targetDir);
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
  const activeGuideCount = new Set(activeRules.map((r) => r.guideId)).size;

  const scanStats: { skippedDocsAndTestsCount?: number } = {};
  const findings =
    activeRuleCount > 0
      ? await scanRepoFiles(resolvedDir, activeRules, {
          maxFiles: options?.maxFiles,
          includeDocsAndTests,
          stats: scanStats,
        })
      : [];
  const skippedDocsAndTestsCount = scanStats.skippedDocsAndTestsCount ?? 0;

  const ruleMap = new Map(activeRules.map((r) => [r.id, r]));
  const findingsByGuide = Map.groupBy(findings, (f) => f.guideId);
  const sortedGuideIds = Array.from(findingsByGuide.keys()).sort();

  const guides: AnalyzeCliGuideGroup[] = sortedGuideIds.map((gid) => {
    const guideFindings = findingsByGuide.get(gid)!;
    guideFindings.sort(
      (a, b) =>
        a.file.localeCompare(b.file) ||
        a.line - b.line ||
        a.ruleId.localeCompare(b.ruleId),
    );

    const cliFindings: AnalyzeCliFinding[] = guideFindings.map((f) => {
      const rule = ruleMap.get(f.ruleId);
      if (!rule) {
        throw new Error(`Rule definition not found for ruleId "${f.ruleId}" (guide "${gid}")`);
      }
      if (!rule.summary?.trim()) {
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
    });

    const byRule = Map.groupBy(cliFindings, (f) => f.ruleId);
    const ruleGroups: AnalyzeCliRuleGroup[] = Array.from(byRule.keys())
      .sort()
      .map((rid) => {
        const rf = byRule.get(rid)!;
        const rule = ruleMap.get(rid)!;
        return {
          ruleId: rid,
          summary: rule.summary,
          ...(rule.verifierRubric ? { verifierRubric: rule.verifierRubric } : {}),
          count: rf.length,
          findings: rf,
        };
      });

    const primaryRule = ruleGroups[0]!;
    const isSingleRule = ruleGroups.length === 1;

    return {
      guideId: gid,
      tier: getGuideConfidenceTier(gid),
      summary: isSingleRule
        ? primaryRule.summary
        : ruleGroups.map((rg) => rg.summary).join('; '),
      retrieveCommand: `npx modern-web-guidance retrieve ${gid}`,
      ...(isSingleRule && primaryRule.verifierRubric
        ? { verifierRubric: primaryRule.verifierRubric }
        : {}),
      count: cliFindings.length,
      findings: cliFindings,
      ...(isSingleRule ? {} : { rules: ruleGroups }),
    };
  });

  const totalFindings = findings.length;
  const data: AnalyzeJsonOutput = {
    targetDir,
    totalFindings,
    guides,
    activeRuleCount,
    activeGuideCount,
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
    activeGuideCount,
    isDefaultQualifiedMode,
    skippedDocsAndTestsCount,
  });
  return { exitCode: 0, output, data };
}

export function writeAnalyzeCliResult(result: AnalyzeCliResult): number {
  const stream =
    result.exitCode === 0 || result.data !== undefined ? process.stdout : process.stderr;
  stream.write(result.output);
  process.exitCode = result.exitCode;
  return result.exitCode;
}

const isMainModule =
  Boolean(import.meta.main) ||
  (Boolean(process.argv[1]) &&
    (resolve(process.argv[1]) === fileURLToPath(import.meta.url) ||
      process.argv[1].endsWith('analyze.mjs')));

if (isMainModule) {
  runAnalyzeCli(process.argv.slice(2))
    .then(writeAnalyzeCliResult)
    .catch((err: unknown) => {
      console.error('Modern Web Guidance Analyzer error:', err);
      process.exitCode = 1;
    });
}
