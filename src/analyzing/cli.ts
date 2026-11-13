import { readFile, stat } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, styleText } from 'node:util';
import { QUALIFIED_RULES } from './rules/index.ts';
import { MAX_SOURCE_FILE_BYTES, scanFiles, scanRepoFiles, shouldScanFile } from './scanners/index.ts';
import type {
  AnalyzerFinding,
  AnalyzerRule,
  VerifierRubric,
} from './schema.ts';

export interface AnalyzeCliFinding {
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly lineContent: string;
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
  readonly retrieveCommand: string;
  readonly count: number;
  readonly rules: readonly AnalyzeCliRuleGroup[];
}

export interface AnalyzeJsonOutput {
  readonly targetDir: string;
  readonly totalFindings: number;
  readonly guides: readonly AnalyzeCliGuideGroup[];
  readonly activeRuleCount?: number;
  readonly activeGuideCount?: number;
  readonly error?: string;
  readonly skippedDocsAndTestsCount?: number;
  readonly note?: string;
}

export interface AnalyzeCliExecutionOptions {
  readonly rules?: readonly AnalyzerRule[];
  readonly cwd?: string;
  readonly maxFiles?: number;
}

export interface AnalyzeCliResult {
  readonly exitCode: number;
  readonly output: string;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly data?: AnalyzeJsonOutput;
}

export interface FormatHumanReadableOptions {
  readonly activeGuideCount?: number;
  readonly isDefaultQualifiedMode?: boolean;
  readonly color?: boolean;
  readonly skippedDocsAndTestsCount?: number;
}

export type TextStyle = Parameters<typeof styleText>[0];

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function shouldEnableColor(optionsColor?: boolean): boolean {
  if (optionsColor !== undefined) return optionsColor;
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false;
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== '0') return true;
  return Boolean(process.stdout?.isTTY);
}

export function elideText(text: string, maxLen = 110): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return normalized.length <= maxLen ? normalized : `${normalized.slice(0, maxLen - 1).trimEnd()}…`;
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
      const item = list[round];
      if (item) {
        sampled.push(item);
        if (sampled.length === maxTotal) return sampled;
      }
    }
  }
  return sampled;
}

export const ANALYZE_CLI_HELP = `
Usage: modern-web-guidance legacy-scan [path] [options]

Analyze a codebase for legacy web platform patterns to detect modernization opportunities.

Arguments:
  [path]                    Directory or file to analyze (defaults to current directory)

Options:
  --json                    Output findings as structured JSON for coding agents
  --guide <guideId>         Filter analysis to a specific guide ID
  --include-docs-and-tests  Include documentation, example, demo, and test files in analysis
  -h, --help                Show this help message
`.trim();

function joinRubricItems(items: readonly string[]): string {
  return elideText(
    items.map((s) => s.trim().replace(/\.+$/, '')).join('; '),
    110,
  );
}

function appendFindingGroupBlock(
  lines: string[],
  group: AnalyzeCliRuleGroup,
  indent: string,
  fmt: (style: TextStyle, text: string) => string,
): void {
  lines.push(`${indent}${group.summary}`);
  if (group.verifierRubric) {
    lines.push(`${indent}${fmt('dim', `Keep when: ${joinRubricItems(group.verifierRubric.keepWhen)}`)}`);
    lines.push(`${indent}${fmt('dim', `Drop when: ${joinRubricItems(group.verifierRubric.dropWhen)}`)}`);
  }
  const displayed = sampleDiversifiedFindings(group.findings, 5);
  for (const f of displayed) {
    lines.push(`${indent}- ${f.file}:${f.line}`);
    const preview = elideText(f.lineContent, 80);
    if (preview) {
      lines.push(`${indent}  ${fmt('dim', preview)}`);
    }
  }
  const remaining = group.findings.length - displayed.length;
  if (remaining > 0) {
    lines.push(`${indent}... and ${plural(remaining, 'more finding')}`);
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
          `Skipped ${plural(skippedDocsAndTestsCount, 'docs and test file', 'docs and test files')} (pass --include-docs-and-tests to scan).`,
        )
      : undefined;

  if (totalFindings === 0) {
    const lines = isDefaultMode
      ? [
          `${fmt('bold', 'Modern Web Guidance Analyzer')} — ${targetDir}`,
          `0 findings from ${plural(activeGuideCount, 'qualified guide')}.`,
          fmt(
            'dim',
            `Note: legacy-scan covers legacy patterns for ${plural(activeGuideCount, 'guide')} (~20% of the guidance corpus). Use 'modern-web-guidance search <topic>' for general UI/platform guidance.`,
          ),
          ...(skippedNotice ? [skippedNotice] : []),
        ]
      : [
          ...(skippedNotice ? [skippedNotice] : []),
          `No modernization opportunities found in ${targetDir}${guideFilter ? ` for guide "${guideFilter}"` : ''}.`,
        ];
    return `${lines.join('\n')}\n`;
  }

  const lines: string[] = [
    `${fmt('bold', 'Modern Web Guidance Analyzer')} — ${targetDir}`,
    `Found ${fmt('bold', String(totalFindings))} modernization ${totalFindings === 1 ? 'opportunity' : 'opportunities'} across ${fmt('bold', String(guides.length))} ${guides.length === 1 ? 'guide' : 'guides'}${isDefaultMode ? ` (scanned ${plural(activeGuideCount, 'guide')} with deterministic rules; ~20% of the guidance corpus)` : ''}:`,
    fmt('dim', 'Note: Static analysis results are provisional — verify against the Keep/Drop criteria below.'),
    ...(skippedNotice ? [skippedNotice] : []),
    '',
  ];

  for (const g of guides) {
    const findingCount = plural(g.count, 'finding');
    const countSuffix =
      g.rules.length === 1
        ? `(${findingCount})`
        : `(${findingCount} across ${g.rules.length} rules)`;

    lines.push(`* ${fmt(['bold', 'cyan'], g.guideId)} ${fmt('dim', countSuffix)}`);
    const singleRule = g.rules.length === 1 ? g.rules[0] : undefined;
    if (singleRule) {
      appendFindingGroupBlock(lines, singleRule, '  ', fmt);
    } else {
      for (const rg of g.rules) {
        lines.push('');
        lines.push(`  ${fmt('bold', rg.ruleId)} ${fmt('dim', `(${plural(rg.count, 'finding')})`)}`);
        appendFindingGroupBlock(lines, rg, '    ', fmt);
      }
    }
    lines.push('');
  }

  lines.push(
    `Retrieve a guide: ${fmt('cyan', 'npx modern-web-guidance retrieve <guide-id>')}`,
  );

  return `${lines.join('\n').trimEnd()}\n`;
}

function errorCliResult(error: string, isJson: boolean, targetDir = '.'): AnalyzeCliResult {
  if (isJson) {
    const data: AnalyzeJsonOutput = { targetDir, totalFindings: 0, guides: [], error };
    const output = `${JSON.stringify(data, null, 2)}\n`;
    return { exitCode: 1, output, stdout: output, stderr: '', data };
  }
  const output = `Error: ${error}\n`;
  return { exitCode: 1, output, stdout: '', stderr: output };
}

function groupFindingsByGuide(
  findings: readonly AnalyzerFinding[],
  activeRules: readonly AnalyzerRule[],
): AnalyzeCliGuideGroup[] {
  const ruleMap = new Map(activeRules.map((r) => [r.id, r]));
  const findingsByGuide = Map.groupBy(findings, (f) => f.guideId);

  return Array.from(findingsByGuide.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([gid, guideFindings]) => {
      const byRule = Map.groupBy(guideFindings, (f) => f.ruleId);
      const rules: AnalyzeCliRuleGroup[] = Array.from(byRule.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([rid, rf]) => {
          const rule = ruleMap.get(rid);
          if (!rule) {
            throw new Error(`Rule definition not found for ruleId "${rid}" (guide "${gid}")`);
          }
          if (!rule.summary?.trim()) {
            throw new Error(`Rule "${rule.id}" is missing a required summary string`);
          }
          rf.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
          const cliFindings: AnalyzeCliFinding[] = rf.map((f) => ({
            file: f.file,
            line: f.line,
            message: f.message,
            lineContent: f.lineContent ?? '',
          }));
          return {
            ruleId: rid,
            summary: rule.summary,
            ...(rule.verifierRubric ? { verifierRubric: rule.verifierRubric } : {}),
            count: cliFindings.length,
            findings: cliFindings,
          };
        });

      return {
        guideId: gid,
        retrieveCommand: `npx modern-web-guidance retrieve ${gid}`,
        count: guideFindings.length,
        rules,
      };
    });
}

/**
 * Deterministic CLI runner for modern-web-guidance analyze.
 * Supports human-readable output, --json structured output, and --guide filtering.
 */
export async function runAnalyzeCli(
  args: readonly string[],
  options?: AnalyzeCliExecutionOptions,
): Promise<AnalyzeCliResult> {
  const cleanArgs = (args[0] === 'legacy-scan' || args[0] === 'analyze') ? args.slice(1) : args;

  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...cleanArgs],
      options: {
        json: { type: 'boolean' },
        guide: { type: 'string' },
        'include-docs-and-tests': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        'skill-version': { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    const isJson = cleanArgs.includes('--json');
    const targetDir =
      cleanArgs.find(
        (a, i) =>
          !a.startsWith('-') &&
          cleanArgs[i - 1] !== '--skill-version' &&
          cleanArgs[i - 1] !== '--guide',
      ) || '.';
    return errorCliResult(error, isJson, targetDir);
  }

  if (parsed.values.help) {
    const output = `${ANALYZE_CLI_HELP}\n`;
    return { exitCode: 0, output, stdout: output, stderr: '' };
  }

  const isJson = Boolean(parsed.values.json);
  const guideFilter = typeof parsed.values.guide === 'string' ? parsed.values.guide : undefined;
  const includeDocsAndTests = Boolean(parsed.values['include-docs-and-tests']);
  const targetDir = parsed.positionals[0] || '.';
  const baseCwd = options?.cwd ?? process.cwd();
  const resolvedDir = resolve(baseCwd, targetDir);

  const isDefaultQualifiedMode = !guideFilter && options?.rules === undefined;
  const baseRules = options?.rules ?? QUALIFIED_RULES;
  const activeRules = guideFilter ? baseRules.filter((r) => r.guideId === guideFilter) : baseRules;
  if (guideFilter && activeRules.length === 0) {
    return errorCliResult(`Unknown or unsupported analyzer guide ID: ${guideFilter}`, isJson, targetDir);
  }
  const activeRuleCount = activeRules.length;
  const activeGuideCount = new Set(activeRules.map((r) => r.guideId)).size;

  const dirStat = await stat(resolvedDir).catch(() => null);
  if (!dirStat) {
    return errorCliResult(`Target path not found: ${targetDir}`, isJson, targetDir);
  }
  if (!dirStat.isFile() && !dirStat.isDirectory()) {
    return errorCliResult(`Target path is not a file or directory: ${targetDir}`, isJson, targetDir);
  }

  const scanStats: { skippedDocsAndTestsCount?: number } = {};
  let findings: AnalyzerFinding[] = [];

  if (activeRuleCount > 0) {
    if (dirStat.isFile()) {
      const files = new Map<string, string>();
      if (dirStat.size > MAX_SOURCE_FILE_BYTES) {
        return errorCliResult(`Target file exceeds maximum size (${MAX_SOURCE_FILE_BYTES} bytes): ${targetDir}`, isJson, targetDir);
      }
      const content = await readFile(resolvedDir, 'utf8');
      const rel = relative(baseCwd, resolvedDir).replace(/\\/g, '/');
      const fileKey = rel && !rel.startsWith('..') ? rel : basename(resolvedDir);
      files.set(fileKey, content);
      const fileFilterOptions = { includeDocsAndTests: true, ignoreAncestorDirs: true };
      findings = scanFiles(files, activeRules, { fileFilterOptions });
      if (findings.length === 0 && !shouldScanFile(fileKey, content, fileFilterOptions)) {
        return errorCliResult(`Target file cannot be scanned (unsupported, minified, or vendored): ${targetDir}`, isJson, targetDir);
      }
    } else {
      findings = await scanRepoFiles(resolvedDir, activeRules, {
        maxFiles: options?.maxFiles,
        includeDocsAndTests,
        stats: scanStats,
      });
    }
  }
  const skippedDocsAndTestsCount = scanStats.skippedDocsAndTestsCount ?? 0;

  const guides = groupFindingsByGuide(findings, activeRules);
  const totalFindings = findings.length;
  const data: AnalyzeJsonOutput = {
    targetDir,
    totalFindings,
    guides,
    activeRuleCount,
    activeGuideCount,
    ...(isDefaultQualifiedMode
      ? {
          note:
            totalFindings === 0
              ? `No legacy patterns found across ${plural(activeGuideCount, 'guide')} (${activeRuleCount} rules; ~20% of the guidance corpus). Use 'search <topic>' for feature-specific guidance.`
              : `Checked ${plural(activeGuideCount, 'guide')} (${activeRuleCount} deterministic rules; ~20% of the guidance corpus). Finding ${totalFindings} ${totalFindings === 1 ? 'item' : 'items'} here only reflects deterministic legacy patterns; use 'search <topic>' for the rest of the catalog.`,
        }
      : {}),
    ...(skippedDocsAndTestsCount > 0 ? { skippedDocsAndTestsCount } : {}),
  };

  if (isJson) {
    const output = `${JSON.stringify(data, null, 2)}\n`;
    return { exitCode: 0, output, stdout: output, stderr: '', data };
  }

  const output = formatHumanReadable(targetDir, totalFindings, guides, guideFilter, {
    activeGuideCount,
    isDefaultQualifiedMode,
    skippedDocsAndTestsCount,
  });
  return { exitCode: 0, output, stdout: output, stderr: '', data };
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
      process.argv[1].endsWith('legacy-scan.mjs') ||
      process.argv[1].endsWith('analyze.mjs')));

if (isMainModule) {
  runAnalyzeCli(process.argv.slice(2))
    .then(writeAnalyzeCliResult)
    .catch((err: unknown) => {
      console.error('Modern Web Guidance Analyzer error:', err);
      process.exitCode = 1;
    });
}
