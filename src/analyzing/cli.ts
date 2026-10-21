/* oxlint-disable max-lines-per-function */
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SUSPENDED_QUALIFIED_GUIDE_IDS } from './qualification.ts';
import {
  ALL_RULES,
  JSON_QUALIFIED_RULES,
  QUALIFIED_GUIDE_IDS,
  TERMINAL_QUALIFIED_RULES,
} from './rules/index.ts';
import { scanRepoFiles } from './scanners/index.ts';
import type { AnalyzerFinding, AnalyzerRule, Phase2Rubric } from './schema.ts';

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
}

export interface AnalyzeCliGuideGroup {
  readonly guideId: string;
  readonly tier: GuideConfidenceTier;
  readonly summary: string;
  readonly retrieveCommand: string;
  readonly phase2Rubric?: Phase2Rubric;
  readonly count: number;
  readonly findings: readonly AnalyzeCliFinding[];
}

export interface AnalyzeJsonOutput {
  readonly targetDir: string;
  readonly totalFindings: number;
  readonly guides: readonly AnalyzeCliGuideGroup[];
  readonly activeRuleCount?: number;
  readonly activeGuideCount?: number;
  readonly suspendedGuides?: readonly string[];
  readonly statusNotice?: string;
  readonly error?: string;
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
  readonly suspendedGuides?: readonly string[];
  readonly isDefaultQualifiedMode?: boolean;
}

export const ANALYZE_CLI_HELP = `
Usage: modern-web-guidance analyze <dir> [options]

Analyze a codebase for legacy web platform patterns to detect modernization opportunities.

Arguments:
  <dir>              Directory to analyze (defaults to current directory)

Options:
  --json             Output findings as structured JSON for coding agents
  --guide <guideId>  Filter analysis to a specific guide ID
  --all-rules        Include all experimental rules (pass to scan all available rules)
  --experimental     Alias for --all-rules
  -h, --help         Show this help message
`.trim();

export function buildQualificationStatusNotice(
  activeRuleCount: number,
  activeGuideCount: number,
  suspendedGuides: readonly string[],
): string | undefined {
  if (activeRuleCount === 0) {
    const suspendedCount = suspendedGuides.length;
    const countPhrase =
      suspendedCount > 0 ? ` (${suspendedCount} previously qualified guides)` : '';
    return `Default qualified guides${countPhrase} are currently suspended pending re-validation (D-041 / D-042). 0 rules were run; pass --all-rules (or --experimental) for experimental findings.`;
  }
  if (suspendedGuides.length > 0) {
    return `${suspendedGuides.length} previously qualified ${suspendedGuides.length === 1 ? 'guide is' : 'guides are'} currently suspended pending re-validation (D-041 / D-042); only ${activeGuideCount} qualified ${activeGuideCount === 1 ? 'guide was' : 'guides were'} scanned. Pass --all-rules (or --experimental) for experimental findings.`;
  }
  return undefined;
}

/**
 * Formats findings into human-readable terminal output.
 * Renders provisional verification notice, visible keepWhen / dropWhen rubric lines,
 * and caps displayed findings at 5 per guide with an overflow summary line (D-032, D-033).
 * When the default qualified set is empty or reduced, states plainly that guides are
 * suspended pending re-validation and points to --all-rules rather than claiming no
 * legacy patterns were found (O6, D-042).
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
  const suspendedGuides = formatOptions?.suspendedGuides ?? [];

  if (totalFindings === 0) {
    if (isDefaultMode && activeRuleCount === 0) {
      return [
        `Modern Web Guidance Analyzer: ${targetDir}`,
        `Default qualified guides are currently suspended pending re-validation (D-041 / D-042); 0 rules were run.`,
        `Pass --all-rules (or --experimental) for experimental findings across ${ALL_RULES.length} rules.`,
        '',
      ].join('\n');
    }
    if (isDefaultMode && suspendedGuides.length > 0) {
      return [
        `Modern Web Guidance Analyzer: ${targetDir}`,
        `0 findings from ${activeGuideCount} active qualified ${activeGuideCount === 1 ? 'guide' : 'guides'}.`,
        `Note: ${suspendedGuides.length} ${suspendedGuides.length === 1 ? 'guide is' : 'guides are'} suspended pending re-validation (${suspendedGuides.join(', ')}); pass --all-rules (or --experimental) for experimental findings.`,
        '',
      ].join('\n');
    }
    const filterNote = guideFilter ? ` for guide "${guideFilter}"` : '';
    return `No modernization opportunities found in ${targetDir}${filterNote}.\n`;
  }

  const lines: string[] = [
    'Note: Static analysis results are provisional and need verification with an agent.',
  ];
  if (isDefaultMode && suspendedGuides.length > 0) {
    lines.push(
      `Note: ${suspendedGuides.length} ${suspendedGuides.length === 1 ? 'guide is' : 'guides are'} currently suspended pending re-validation (${suspendedGuides.join(', ')}); pass --all-rules for experimental findings.`,
    );
  }
  lines.push(
    '',
    `Modern Web Guidance Analyzer: ${targetDir}`,
    `Found ${totalFindings} modernization ${totalFindings === 1 ? 'opportunity' : 'opportunities'} across ${guides.length} ${guides.length === 1 ? 'guide' : 'guides'}:`,
    '',
  );

  for (const g of guides) {
    const badge = g.tier === 'qualified' ? '[qualified]' : '[experimental]';
    lines.push(`* ${badge} ${g.guideId} (${g.count} ${g.count === 1 ? 'finding' : 'findings'})`);
    lines.push(`  Summary: ${g.summary}`);
    if (g.phase2Rubric) {
      const keepText = Array.isArray(g.phase2Rubric.keepWhen)
        ? g.phase2Rubric.keepWhen.join('; ')
        : String(g.phase2Rubric.keepWhen);
      const dropText = Array.isArray(g.phase2Rubric.dropWhen)
        ? g.phase2Rubric.dropWhen.join('; ')
        : String(g.phase2Rubric.dropWhen);
      lines.push(`  Keep when: ${keepText}`);
      lines.push(`  Drop when: ${dropText}`);
    }
    lines.push(`  Retrieve: ${g.retrieveCommand}`);
    lines.push('  Findings:');

    const displayedFindings = g.findings.slice(0, 5);
    for (const f of displayedFindings) {
      lines.push(`    - ${f.file}:${f.line}: ${f.message}`);
    }

    if (g.findings.length > 5) {
      const remainingFindings = g.findings.slice(5);
      const remainingCount = remainingFindings.length;
      const remainingFilesCount = new Set(remainingFindings.map((f) => f.file)).size;
      const fileWord = remainingFilesCount === 1 ? 'file' : 'files';
      lines.push(`  ...and ${remainingCount} more in ${remainingFilesCount} ${fileWord}`);
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
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
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: false,
  });

  const isJson = Boolean(parsed.values.json);
  const guideFilter = typeof parsed.values.guide === 'string' ? parsed.values.guide : undefined;
  const isHelp = Boolean(parsed.values.help);
  const useAllRules = Boolean(parsed.values['all-rules'] || parsed.values.experimental);
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
      : isJson
        ? JSON_QUALIFIED_RULES
        : TERMINAL_QUALIFIED_RULES;
  const activeRulesList = options?.rules ?? defaultRules;
  const activeRules = guideFilter
    ? activeRulesList.filter((r) => r.guideId === guideFilter)
    : activeRulesList;

  const activeRuleCount = activeRules.length;
  const activeGuideIds = new Set(activeRules.map((r) => r.guideId));
  const activeGuideCount = activeGuideIds.size;
  const suspendedGuides = isDefaultQualifiedMode
    ? SUSPENDED_QUALIFIED_GUIDE_IDS.filter((gid) => !activeGuideIds.has(gid))
    : [];
  const statusNotice = isDefaultQualifiedMode
    ? buildQualificationStatusNotice(activeRuleCount, activeGuideCount, suspendedGuides)
    : undefined;

  const findings =
    activeRuleCount > 0
      ? await scanRepoFiles(resolvedDir, activeRules, {
          maxFiles: options?.maxFiles,
        })
      : [];

  const findingsByGuide = new Map<string, AnalyzerFinding[]>();
  for (const f of findings) {
    const list = findingsByGuide.get(f.guideId) ?? [];
    list.push(f);
    findingsByGuide.set(f.guideId, list);
  }

  const summaryMap = new Map<string, string>();
  const rubricMap = new Map<string, Phase2Rubric>();
  for (const r of ALL_RULES) {
    if (!summaryMap.has(r.guideId)) {
      summaryMap.set(r.guideId, r.summary);
    }
    if (!rubricMap.has(r.guideId)) {
      rubricMap.set(r.guideId, r.phase2Rubric);
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

    const summary = summaryMap.get(gid) ?? `Modernize legacy web pattern for ${gid}`;
    const phase2Rubric = rubricMap.get(gid);
    const tier = getGuideConfidenceTier(gid);
    return {
      guideId: gid,
      tier,
      summary,
      retrieveCommand: `npx modern-web-guidance retrieve ${gid}`,
      ...(phase2Rubric ? { phase2Rubric } : {}),
      count: guideFindings.length,
      findings: guideFindings.map((f) => ({
        ruleId: f.ruleId,
        file: f.file,
        line: f.line,
        message: f.message,
        codeSnippet: f.codeSnippet || f.astSlice,
      })),
    };
  });

  const totalFindings = findings.length;
  const data: AnalyzeJsonOutput = {
    targetDir,
    totalFindings,
    guides,
    activeRuleCount,
    activeGuideCount,
    ...(suspendedGuides.length > 0 ? { suspendedGuides } : {}),
    ...(statusNotice ? { statusNotice } : {}),
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
    suspendedGuides,
    isDefaultQualifiedMode,
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
      if (result.exitCode === 0) {
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
