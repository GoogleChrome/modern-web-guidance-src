/* oxlint-disable max-lines-per-function */
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  ALL_RULES,
  QUALIFIED_RULES,
  TIER_1_GUIDE_IDS,
  TIER_1_RULES,
  TIER_2_GUIDE_IDS,
} from './rules/index.ts';
import { scanRepoFiles } from './scanners/index.ts';
import type { AnalyzerFinding, AnalyzerRule, Phase2Rubric } from './schema.ts';

export type GuideConfidenceTier =
  | 'tier-1-proven'
  | 'tier-2-unmeasured'
  | 'tier-2-zero-fp'
  | 'tier-3-experimental';

export function getGuideConfidenceTier(guideId: string): GuideConfidenceTier {
  if (TIER_1_GUIDE_IDS.includes(guideId)) return 'tier-1-proven';
  if (TIER_2_GUIDE_IDS.includes(guideId)) return 'tier-2-unmeasured';
  return 'tier-3-experimental';
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

export const ANALYZE_CLI_HELP = `
Usage: modern-web-guidance analyze <dir> [options]

Analyze a codebase for legacy web platform patterns and suggest modern web standard replacements.

Arguments:
  <dir>              Directory to analyze (defaults to current directory)

Options:
  --json             Output findings as structured JSON for coding agents
  --guide <guideId>  Filter analysis to a specific guide ID
  --tier=1           Scan strictly with Tier 1 proven rules (8 high-N guides, 99.1% precision)
  --proven-only      Alias for --tier=1
  --all-rules        Include all experimental/unqualified rules (defaults to 25 verified qualified rules)
  --experimental     Alias for --all-rules
  -h, --help         Show this help message
`.trim();

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
      tier: { type: 'string' },
      'proven-only': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: false,
  });

  const isJson = Boolean(parsed.values.json);
  const guideFilter = typeof parsed.values.guide === 'string' ? parsed.values.guide : undefined;
  const isHelp = Boolean(parsed.values.help);
  const isTier1Only = Boolean(parsed.values['proven-only'] || parsed.values.tier === '1');
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

  const defaultRules = isTier1Only
    ? TIER_1_RULES
    : useAllRules
      ? ALL_RULES
      : QUALIFIED_RULES;
  const activeRulesList = options?.rules ?? defaultRules;
  const activeRules = guideFilter
    ? activeRulesList.filter((r) => r.guideId === guideFilter)
    : activeRulesList;

  const findings = await scanRepoFiles(resolvedDir, activeRules, {
    maxFiles: options?.maxFiles,
  });

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
  };

  if (isJson) {
    return {
      exitCode: 0,
      output: JSON.stringify(data, null, 2) + '\n',
      data,
    };
  }

  if (totalFindings === 0) {
    const filterNote = guideFilter ? ` for guide "${guideFilter}"` : '';
    const output = `No modernization opportunities found in ${targetDir}${filterNote}.\n`;
    return { exitCode: 0, output, data };
  }

  const lines: string[] = [
    `Modern Web Guidance Analyzer: ${targetDir}`,
    `Found ${totalFindings} modernization ${totalFindings === 1 ? 'opportunity' : 'opportunities'} across ${guides.length} ${guides.length === 1 ? 'guide' : 'guides'}:`,
    '',
  ];

  for (const g of guides) {
    const badge =
      g.tier === 'tier-1-proven'
        ? '[tier-1]'
        : g.tier === 'tier-2-unmeasured' || g.tier === 'tier-2-zero-fp'
          ? '[tier-2: unmeasured (too few findings)]'
          : '[experimental]';
    lines.push(`* ${badge} ${g.guideId} (${g.count} ${g.count === 1 ? 'finding' : 'findings'})`);
    lines.push(`  Summary: ${g.summary}`);
    lines.push(`  Retrieve: ${g.retrieveCommand}`);
    lines.push('  Findings:');
    for (const f of g.findings) {
      lines.push(`    - ${f.file}:${f.line}: ${f.message}`);
    }
    lines.push('');
  }

  const output = lines.join('\n').trimEnd() + '\n';
  return { exitCode: 0, output, data };
}

if (import.meta.main || (process.argv[1] && process.argv[1].endsWith('cli.ts'))) {
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
