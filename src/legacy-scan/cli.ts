import { readFile, stat } from 'node:fs/promises';
import { basename, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, styleText } from 'node:util';
import { QUALIFIED_RULES } from './rules/index.ts';
import {
  DEFAULT_MAX_FILES,
  MAX_SOURCE_FILE_BYTES,
  resolveMaxFiles,
  scanFiles,
  scanRepoFiles,
  type RepoScanStats,
} from './scanners/index.ts';
import type {
  ScanFinding,
  ScanRule,
  VerifierRubric,
} from './schema.ts';

export interface CliFinding {
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly lineContent: string;
}

export interface CliRuleGroup {
  readonly ruleId: string;
  readonly summary: string;
  readonly verifierRubric?: VerifierRubric;
  readonly count: number;
  readonly findings: readonly CliFinding[];
}

export interface CliGuideGroup {
  readonly guideId: string;
  readonly retrieveCommand: string;
  readonly count: number;
  readonly rules: readonly CliRuleGroup[];
}

export interface ScanJsonOutput {
  /** The first target path. */
  readonly targetDir: string;
  /** Every target path, present only when more than one was scanned. */
  readonly targets?: readonly string[];
  readonly totalFindings: number;
  readonly guides: readonly CliGuideGroup[];
  readonly activeRuleCount?: number;
  readonly activeGuideCount?: number;
  readonly scannedFileCount?: number;
  readonly eligibleFileCount?: number;
  readonly truncatedByMaxFiles?: boolean;
  readonly error?: string;
  readonly skippedDocsAndTestsCount?: number;
  readonly note?: string;
}

export interface CliExecutionOptions {
  readonly rules?: readonly ScanRule[];
  readonly cwd?: string;
  readonly maxFiles?: number;
}

export interface CliResult {
  readonly exitCode: number;
  readonly output: string;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly data?: ScanJsonOutput;
}

export interface TruncationInfo {
  readonly scannedFileCount: number;
  readonly eligibleFileCount: number;
}

export interface FormatHumanReadableOptions {
  readonly activeGuideCount?: number;
  readonly isDefaultQualifiedMode?: boolean;
  readonly color?: boolean;
  readonly skippedDocsAndTestsCount?: number;
  readonly truncation?: TruncationInfo;
}

export type TextStyle = Parameters<typeof styleText>[0];

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}

function formatTruncationNotice(scannedFileCount: number, eligibleFileCount: number): string {
  return (
    `Scanned ${formatCount(scannedFileCount)} of ${formatCount(eligibleFileCount)} eligible files (--max-files cap). ` +
    'Re-run with --max-files 0 or target a subdirectory for full coverage.'
  );
}

const MAX_FILES_CLI_RE = /^(?:0|[1-9]\d*)$/;

function parseMaxFilesCliOption(raw: string): number | null {
  if (!MAX_FILES_CLI_RE.test(raw)) {
    return null;
  }
  try {
    return resolveMaxFiles(Number(raw));
  } catch {
    return null;
  }
}

const CLI_PARSE_OPTIONS = {
  json: { type: 'boolean' },
  guide: { type: 'string' },
  'include-docs-and-tests': { type: 'boolean' },
  'max-files': { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  'skill-version': { type: 'string' },
} as const;

const STRING_OPTION_FLAGS: ReadonlySet<string> = new Set(
  Object.entries(CLI_PARSE_OPTIONS)
    .filter(([, cfg]) => cfg.type === 'string')
    .map(([name]) => `--${name}`),
);

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
  findings: readonly CliFinding[],
  maxTotal = 5,
): CliFinding[] {
  if (findings.length <= maxTotal) return [...findings];
  const fileLists = Array.from(Map.groupBy(findings, (f) => f.file).values());
  const sampled: CliFinding[] = [];
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

export const CLI_HELP = `
Usage: modern-web-guidance legacy-scan [paths...] [options]

Analyze a codebase for legacy web platform patterns to detect modernization opportunities.

Arguments:
  [paths...]                Directories or files to analyze (defaults to current directory)

Options:
  --json                    Output findings as structured JSON for coding agents
  --guide <guideId>         Filter analysis to a specific guide ID
  --include-docs-and-tests  Include documentation, example, demo, and test files in analysis
  --max-files <count>       Maximum eligible files to scan (default: ${DEFAULT_MAX_FILES}; 0 for unlimited); applies per directory
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
  group: CliRuleGroup,
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
  guides: readonly CliGuideGroup[],
  guideFilter?: string,
  formatOptions?: FormatHumanReadableOptions,
): string {
  const isDefaultMode = formatOptions?.isDefaultQualifiedMode ?? false;
  const activeGuideCount = formatOptions?.activeGuideCount ?? 0;
  const skippedDocsAndTestsCount = formatOptions?.skippedDocsAndTestsCount ?? 0;
  const truncation = formatOptions?.truncation;
  const colorEnabled = shouldEnableColor(formatOptions?.color);

  const fmt = (style: TextStyle, text: string): string =>
    colorEnabled ? styleText(style, text, { validateStream: false }) : text;

  const truncationNotice = truncation
    ? fmt('yellow', formatTruncationNotice(truncation.scannedFileCount, truncation.eligibleFileCount))
    : undefined;

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
          `${fmt('bold', 'Modern Web Guidance legacy-scan')} — ${targetDir}`,
          truncation
            ? `0 findings in scanned subset across ${plural(activeGuideCount, 'qualified guide')}.`
            : `0 findings from ${plural(activeGuideCount, 'qualified guide')}.`,
          ...(truncationNotice ? [truncationNotice] : []),
          fmt(
            'dim',
            `Note: legacy-scan covers legacy patterns for ${plural(activeGuideCount, 'guide')} (~20% of the guidance corpus). Use 'modern-web-guidance search <topic>' for general UI/platform guidance.`,
          ),
          ...(skippedNotice ? [skippedNotice] : []),
        ]
      : [
          ...(truncationNotice ? [truncationNotice] : []),
          ...(skippedNotice ? [skippedNotice] : []),
          truncation
            ? `No modernization opportunities found in scanned files under ${targetDir}${guideFilter ? ` for guide "${guideFilter}"` : ''}.`
            : `No modernization opportunities found in ${targetDir}${guideFilter ? ` for guide "${guideFilter}"` : ''}.`,
        ];
    return `${lines.join('\n')}\n`;
  }

  const lines: string[] = [
    `${fmt('bold', 'Modern Web Guidance legacy-scan')} — ${targetDir}`,
    `Found ${fmt('bold', String(totalFindings))} modernization ${totalFindings === 1 ? 'opportunity' : 'opportunities'} across ${fmt('bold', String(guides.length))} ${guides.length === 1 ? 'guide' : 'guides'}${isDefaultMode ? ` (scanned ${plural(activeGuideCount, 'guide')} with deterministic rules; ~20% of the guidance corpus)` : ''}:`,
    fmt('dim', 'Note: Static analysis results are provisional — verify against the Keep/Drop criteria below.'),
    ...(truncationNotice ? [truncationNotice] : []),
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

function errorCliResult(error: string, isJson: boolean, targetDir = '.'): CliResult {
  if (isJson) {
    const data: ScanJsonOutput = { targetDir, totalFindings: 0, guides: [], error };
    const output = `${JSON.stringify(data, null, 2)}\n`;
    return { exitCode: 1, output, stdout: output, stderr: '', data };
  }
  const output = `Error: ${error}\n`;
  return { exitCode: 1, output, stdout: '', stderr: output };
}

function groupFindingsByGuide(
  findings: readonly ScanFinding[],
  activeRules: readonly ScanRule[],
): CliGuideGroup[] {
  const ruleMap = new Map(activeRules.map((r) => [r.id, r]));
  const findingsByGuide = Map.groupBy(findings, (f) => f.guideId);

  return Array.from(findingsByGuide.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([gid, guideFindings]) => {
      const byRule = Map.groupBy(guideFindings, (f) => f.ruleId);
      const rules: CliRuleGroup[] = Array.from(byRule.entries())
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
          const cliFindings: CliFinding[] = rf.map((f) => ({
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
 * Deterministic CLI runner for modern-web-guidance legacy-scan.
 * Supports human-readable output, --json structured output, --guide filtering, and --max-files cap.
 */
export async function runLegacyScanCli(
  args: readonly string[],
  options?: CliExecutionOptions,
): Promise<CliResult> {
  const cleanArgs = (args[0] === 'legacy-scan' || args[0] === 'analyze') ? args.slice(1) : args;

  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...cleanArgs],
      options: CLI_PARSE_OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    const isJson = cleanArgs.includes('--json');
    const targetDir =
      cleanArgs.find((a, i) => !a.startsWith('-') && !STRING_OPTION_FLAGS.has(cleanArgs[i - 1] ?? '')) ||
      '.';
    return errorCliResult(error, isJson, targetDir);
  }

  if (parsed.values.help) {
    const output = `${CLI_HELP}\n`;
    return { exitCode: 0, output, stdout: output, stderr: '' };
  }

  const isJson = Boolean(parsed.values.json);
  const guideFilter = typeof parsed.values.guide === 'string' ? parsed.values.guide : undefined;
  const includeDocsAndTests = Boolean(parsed.values['include-docs-and-tests']);
  const targets = (parsed.positionals.length > 0 ? parsed.positionals : ['.']).map((p) => p || '.');
  const targetDir = targets[0] ?? '.';
  const baseCwd = options?.cwd ?? process.cwd();

  const rawMaxFiles = parsed.values['max-files'];
  let effectiveMaxFiles: number;
  if (typeof rawMaxFiles === 'string') {
    const parsedMaxFiles = parseMaxFilesCliOption(rawMaxFiles);
    if (parsedMaxFiles === null) {
      return errorCliResult(
        `Invalid --max-files value ${JSON.stringify(rawMaxFiles)}: expected a non-negative integer (0 for unlimited).`,
        isJson,
        targetDir,
      );
    }
    effectiveMaxFiles = parsedMaxFiles;
  } else {
    effectiveMaxFiles = resolveMaxFiles(options?.maxFiles);
  }

  const isDefaultQualifiedMode = !guideFilter && options?.rules === undefined;
  const baseRules = options?.rules ?? QUALIFIED_RULES;
  const activeRules = guideFilter ? baseRules.filter((r) => r.guideId === guideFilter) : baseRules;
  if (guideFilter && activeRules.length === 0) {
    return errorCliResult(`Unknown or unsupported legacy-scan guide ID: ${guideFilter}`, isJson, targetDir);
  }
  const activeRuleCount = activeRules.length;
  const activeGuideCount = new Set(activeRules.map((r) => r.guideId)).size;

  /** Resolved absolute path -> target, in the order given, without exact repeats. */
  const uniqueTargets = new Map<string, { readonly path: string; readonly isFile: boolean }>();
  for (const path of targets) {
    const resolved = resolve(baseCwd, path);
    if (uniqueTargets.has(resolved)) continue;
    const targetStat = await stat(resolved).catch(() => null);
    if (!targetStat) {
      return errorCliResult(`Target path not found: ${path}`, isJson, targetDir);
    }
    if (!targetStat.isFile() && !targetStat.isDirectory()) {
      return errorCliResult(`Target path is not a file or directory: ${path}`, isJson, targetDir);
    }
    if (targetStat.isFile() && targetStat.size > MAX_SOURCE_FILE_BYTES) {
      return errorCliResult(`Target file exceeds maximum size (${MAX_SOURCE_FILE_BYTES} bytes): ${path}`, isJson, targetDir);
    }
    uniqueTargets.set(resolved, { path, isFile: targetStat.isFile() });
  }
  const targetPaths = [...uniqueTargets.values()].map((t) => t.path);
  const isMultiTarget = targetPaths.length > 1;

  /**
   * Scans one target. With several targets, finding paths are rewritten relative to cwd
   * (absolute when outside it) so that they stay distinct across targets.
   */
  const scanTarget = async (resolved: string, isFile: boolean, stats: RepoScanStats): Promise<ScanFinding[]> => {
    const absolute = resolved.replace(/\\/g, '/');
    const rel = relative(baseCwd, resolved).replace(/\\/g, '/');
    const isOutsideCwd = rel.startsWith('..');
    if (isFile) {
      const content = await readFile(resolved, 'utf8');
      const fileKey = rel && !isOutsideCwd ? rel : basename(resolved);
      const fileFindings = scanFiles(new Map([[fileKey, content]]), activeRules, {
        includeDocsAndTests: true,
        stats,
      });
      if (!isMultiTarget || !isOutsideCwd) return fileFindings;
      return fileFindings.map((f) => ({ ...f, file: absolute }));
    }
    const dirFindings = await scanRepoFiles(resolved, activeRules, {
      maxFiles: effectiveMaxFiles,
      includeDocsAndTests,
      stats,
    });
    if (!isMultiTarget) return dirFindings;
    const prefix = isOutsideCwd ? absolute : rel;
    return dirFindings.map((f) => ({ ...f, file: posix.join(prefix, f.file) }));
  };

  const findings: ScanFinding[] = [];
  const seenFiles = new Set<string>();
  let skippedDocsAndTestsCount = 0;
  let scannedFileCount = 0;
  let eligibleFileCount = 0;
  let truncatedByMaxFiles = false;
  for (const [resolved, { isFile }] of uniqueTargets) {
    const stats: RepoScanStats = {};
    const targetFindings = (await scanTarget(resolved, isFile, stats)).filter((f) => !seenFiles.has(f.file));
    for (const f of targetFindings) {
      seenFiles.add(f.file);
      findings.push(f);
    }
    skippedDocsAndTestsCount += stats.skippedDocsAndTestsCount ?? 0;
    scannedFileCount += stats.scannedFileCount ?? 0;
    eligibleFileCount += stats.eligibleFileCount ?? stats.scannedFileCount ?? 0;
    truncatedByMaxFiles ||= Boolean(stats.truncatedByMaxFiles);
  }

  const guides = groupFindingsByGuide(findings, activeRules);
  const totalFindings = findings.length;

  const truncationHint = truncatedByMaxFiles
    ? `Partial scan only: ${formatTruncationNotice(scannedFileCount, eligibleFileCount).replace(/^Scanned/, 'scanned')}`
    : undefined;
  let corpusHint: string | undefined;
  if (isDefaultQualifiedMode) {
    if (totalFindings === 0) {
      corpusHint = truncatedByMaxFiles
        ? `Found 0 legacy patterns in the scanned subset across ${plural(activeGuideCount, 'guide')} (${activeRuleCount} rules; ~20% of the guidance corpus); use 'search <topic>' for feature-specific guidance.`
        : `No legacy patterns found across ${plural(activeGuideCount, 'guide')} (${activeRuleCount} rules; ~20% of the guidance corpus). Use 'search <topic>' for feature-specific guidance.`;
    } else {
      corpusHint = truncatedByMaxFiles
        ? `Checked ${plural(activeGuideCount, 'guide')} (${activeRuleCount} deterministic rules; ~20% of the guidance corpus); finding ${totalFindings} ${totalFindings === 1 ? 'item' : 'items'} reflects only the scanned subset, and use 'search <topic>' for the rest of the catalog.`
        : `Checked ${plural(activeGuideCount, 'guide')} (${activeRuleCount} deterministic rules; ~20% of the guidance corpus). Finding ${totalFindings} ${totalFindings === 1 ? 'item' : 'items'} here only reflects deterministic legacy patterns; use 'search <topic>' for the rest of the catalog.`;
    }
  }
  const note = [truncationHint, corpusHint].filter(Boolean).join(' ') || undefined;

  const data: ScanJsonOutput = {
    targetDir,
    ...(isMultiTarget ? { targets: targetPaths } : {}),
    totalFindings,
    guides,
    activeRuleCount,
    activeGuideCount,
    scannedFileCount,
    ...(truncatedByMaxFiles
      ? {
          truncatedByMaxFiles: true,
          eligibleFileCount,
        }
      : {}),
    ...(note ? { note } : {}),
    ...(skippedDocsAndTestsCount > 0 ? { skippedDocsAndTestsCount } : {}),
  };

  if (isJson) {
    const output = `${JSON.stringify(data, null, 2)}\n`;
    return { exitCode: 0, output, stdout: output, stderr: '', data };
  }

  const output = formatHumanReadable(targetPaths.join(', '), totalFindings, guides, guideFilter, {
    activeGuideCount,
    isDefaultQualifiedMode,
    skippedDocsAndTestsCount,
    ...(truncatedByMaxFiles
      ? { truncation: { scannedFileCount, eligibleFileCount } }
      : {}),
  });
  return { exitCode: 0, output, stdout: output, stderr: '', data };
}

export function writeLegacyScanCliResult(result: CliResult): number {
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
  runLegacyScanCli(process.argv.slice(2))
    .then(writeLegacyScanCliResult)
    .catch((err: unknown) => {
      console.error('Modern Web Guidance legacy-scan error:', err);
      process.exitCode = 1;
    });
}
