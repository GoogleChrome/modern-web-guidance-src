import fs from 'fs';
import path from 'path';
import { isEnoent, parseJsonlFile, type GuideUsage } from './agent-shared.ts';
import { extractWebRunsFromText } from '../agents/codex-cli-agent.ts';
import type { TrajectorySummary } from './trajectory-normalizer.ts';
import { MODERN_WEB_LOG_FILE } from '../../core/constants.ts';

const HOST_NODE_MODULES_RE = /\/[^\s"'`\\]*modern-web-guidance(?:-src)?\/node_modules[^\s"'`\\]*/g;
const SEARCH_RESULT_SNIPPET_RE =
  /modern-web-guidance[^\n\uE200]*?\n?\uE200cite\uE202turn\d+search\d+\uE201[^\n\uE200]*/g;
const TRUNCATED_SEARCH_HEADER_RE =
  /(?:^|\n)[^\n\uE200]*\(https?:\/\/[^\s()]*modern-web-guidance[^\s()]*\.\.\. \[truncated\]$/;
const HEREDOC_RE = /<<-?\s*['"]?([A-Za-z0-9_]+)['"]?[^\n]*\n[\s\S]*?\n\1(?=\n|$)/g;
const FAILED_OPEN_OUTCOME_URL_RE = /(?:Failed to fetch|URL)\s+(https?:\/\/\S+?)(?::(?:\s|$)|\s+is not accessible)/g;
const FAILED_OPEN_ERROR_ECHO_RE =
  /(?:Source:\s*open\(\{[^\n]*\}\);\s*\n?)?(?:Failed to fetch\s+https?:\/\/[^\n]*|URL\s+https?:\/\/\S+\s+is not accessible[^\n]*)/g;

function extractOpenRefIds(call: string): string[] {
  return Array.from(call.matchAll(/["']?\bref_id["']?\s*:\s*["']([^"']+)["']/g), (m) => m[1]);
}

function isFailedOnlyOpenRun(call: string, failedUrls: ReadonlySet<string>): boolean {
  if (failedUrls.size === 0 || !/["']?\bopen["']?\s*:/.test(call) || /["']?\bsearch_query["']?\s*:/.test(call)) {
    return false;
  }
  const refIds = extractOpenRefIds(call);
  return refIds.length > 0 && refIds.every((id) => failedUrls.has(id));
}

function isSearchOnlyWebRun(call: string, failedUrls?: ReadonlySet<string>): boolean {
  if (!/["']?\bsearch_query["']?\s*:/.test(call)) return false;
  if (!/["']?\bopen["']?\s*:/.test(call)) return true;
  if (!failedUrls || failedUrls.size === 0) return false;
  const refIds = extractOpenRefIds(call);
  return refIds.length > 0 && refIds.every((id) => failedUrls.has(id));
}

function stripHostNodeModules(text: string): string {
  return text.replace(HOST_NODE_MODULES_RE, '');
}

function stripHeredocs(cmd: string): string {
  return cmd.replace(HEREDOC_RE, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches `guideName` as a distinct slug while ignoring `/guides/<guideName>/<other-guide>`
 * category-folder prefixes (e.g. `/guides/webmcp/agentic-javascript-tools` when `guideName` is `webmcp`).
 */
function hasGuideSlugMatch(text: string, guideName: string): boolean {
  const escaped = escapeRegExp(guideName);
  const withoutCategoryPrefix = text.replace(
    new RegExp(`(/guides/)${escaped}(/[a-z0-9-]+)`, 'gi'),
    (match, prefix: string, leaf: string) =>
      leaf.slice(1).toLowerCase() === guideName.toLowerCase() ? match : `${prefix}__category__${leaf}`
  );
  return new RegExp(`(?:^|[^a-z0-9-])${escaped}(?:$|[^a-z0-9-])`, 'i').test(withoutCategoryPrefix);
}

const SUMMARY_FILE = 'trajectory_summary.json';
const GUIDANCE_TOOL_NAME = 'modern-web-guidance';

/** One line of `modern-web.log`, as written by the local guidance server. */
interface ModernWebLogEntry {
  tool?: string;
  result?: unknown;
}

/**
 * Reads and parses `trajectory_summary.json`, or returns `undefined` if it is
 * missing or not valid JSON.
 */
function readSummary(dir: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, SUMMARY_FILE), 'utf8'));
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
    return undefined;
  }
}

function stringArrayOrEmpty(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Guide IDs served by `get_best_practices`, in first-seen order and deduped. */
export function guideIdsFromLog(entries: ModernWebLogEntry[]): string[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry?.tool !== 'get_best_practices' || !Array.isArray(entry.result)) continue;
    for (const r of entry.result) {
      if (typeof r?.id === 'string') ids.add(r.id);
    }
  }
  return [...ids];
}

export async function collectGuidesUsed(dirPath: string): Promise<GuideUsage> {
  const summary = readSummary(dirPath);
  const logEntries = parseJsonlFile<ModernWebLogEntry>(path.join(dirPath, MODERN_WEB_LOG_FILE));
  return {
    retrievedGuides: [...new Set([...stringArrayOrEmpty(summary?.retrievedGuides), ...guideIdsFromLog(logEntries)])],
    fileReadGuides: stringArrayOrEmpty(summary?.fileReadGuides)
  };
}

export async function collectGuidanceToolsUsed(dir: string): Promise<string[]> {
  const toolsUsed = stringArrayOrEmpty(readSummary(dir)?.toolsUsed);
  const logSize = fs.statSync(path.join(dir, MODERN_WEB_LOG_FILE), { throwIfNoEntry: false })?.size ?? 0;
  if (logSize > 0 && !toolsUsed.includes(GUIDANCE_TOOL_NAME)) {
    toolsUsed.push(GUIDANCE_TOOL_NAME);
  }
  return toolsUsed;
}

/**
 * Checks whether a trajectory contains both `modern-web-guidance` and the expected `guideName`,
 * evaluating `trajectory_summary.json` per step and excluding host `node_modules` paths and
 * passive web-search queries/snippets where a guide URL was never opened. Also checks
 * `modern-web.log` so leaks are still caught when the agent trajectory parser fails.
 */
export function hasTrajectoryGuideLeak(dir: string, guideName: string): boolean {
  if (!guideName) return false;
  return (
    summaryHasGuideLeak(path.join(dir, SUMMARY_FILE), guideName) ||
    rawFileIncludes(path.join(dir, MODERN_WEB_LOG_FILE), guideName)
  );
}

function summaryHasGuideLeak(summaryPath: string, guideName: string): boolean {
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as Partial<TrajectorySummary>;
    if (
      (Array.isArray(summary.retrievedGuides) && summary.retrievedGuides.includes(guideName)) ||
      (Array.isArray(summary.fileReadGuides) && summary.fileReadGuides.includes(guideName))
    ) {
      return true;
    }
    if (!Array.isArray(summary.steps)) return false;

    for (const step of summary.steps) {
      const rawParams =
        step?.action?.params && typeof step.action.params === 'object'
          ? (step.action.params as Record<string, unknown>)
          : undefined;

      const failedUrls = new Set<string>(stringArrayOrEmpty(rawParams?.failedOpenUrls));
      if (typeof step?.outcome?.message === 'string') {
        for (const m of step.outcome.message.matchAll(FAILED_OPEN_OUTCOME_URL_RE)) {
          failedUrls.add(m[1]);
        }
      }

      const allWebRuns = Array.isArray(rawParams?.webRuns)
        ? rawParams.webRuns.filter((r): r is string => typeof r === 'string')
        : typeof rawParams?.value === 'string' && rawParams.value.includes('tools.web__run')
          ? extractWebRunsFromText(rawParams.value)
          : [];

      const activeWebRuns = allWebRuns.filter((r) => !isFailedOnlyOpenRun(r, failedUrls));
      const isFailedOnlyWebStep = allWebRuns.length > 0 && activeWebRuns.length === 0;
      const isSearchOnlyWebStep =
        (activeWebRuns.length > 0 && activeWebRuns.every((r) => isSearchOnlyWebRun(r, failedUrls))) ||
        (step?.action?.name === 'web_search' && rawParams?.type === 'search' && !rawParams?.url);

      let paramsText = '';
      if (rawParams) {
        const filteredParams: Record<string, unknown> = { ...rawParams };
        delete filteredParams.failedOpenUrls;
        if (step?.action?.type === 'write_file') {
          delete filteredParams.patch;
          delete filteredParams.content;
          delete filteredParams.new_string;
          delete filteredParams.old_string;
        }
        if (typeof filteredParams.command === 'string') {
          filteredParams.command = stripHeredocs(filteredParams.command);
        }
        if (Array.isArray(filteredParams.commands)) {
          filteredParams.commands = filteredParams.commands.map((c) =>
            typeof c === 'string' ? stripHeredocs(c) : c
          );
        }
        if (Array.isArray(filteredParams.webRuns)) {
          filteredParams.webRuns = (filteredParams.webRuns as unknown[])
            .filter(
              (r) =>
                typeof r !== 'string' ||
                (!isSearchOnlyWebRun(r, failedUrls) && !isFailedOnlyOpenRun(r, failedUrls))
            )
            .map((r) => {
              if (typeof r !== 'string' || failedUrls.size === 0) return r;
              let cleaned = r;
              for (const url of failedUrls) {
                cleaned = cleaned.replaceAll(url, '');
              }
              return cleaned;
            });
        }
        if (typeof filteredParams.value === 'string' && allWebRuns.length > 0) {
          let val = filteredParams.value;
          for (const r of allWebRuns) {
            if (isSearchOnlyWebRun(r, failedUrls) || isFailedOnlyOpenRun(r, failedUrls)) {
              val = val.replace(r, '');
            } else if (failedUrls.size > 0) {
              let cleanedRun = r;
              for (const url of failedUrls) {
                cleanedRun = cleanedRun.replaceAll(url, '');
              }
              val = val.replace(r, cleanedRun);
            }
          }
          filteredParams.value = val;
        }
        if (step?.action?.name === 'web_search' && filteredParams.type === 'search' && !filteredParams.url) {
          delete filteredParams.query;
          delete filteredParams.queries;
        }
        paramsText = stripHostNodeModules(JSON.stringify(filteredParams));
      }

      let outcomeText = '';
      if (!isSearchOnlyWebStep && !isFailedOnlyWebStep && typeof step?.outcome?.message === 'string') {
        outcomeText = stripHostNodeModules(step.outcome.message)
          .replace(FAILED_OPEN_ERROR_ECHO_RE, '')
          .replace(SEARCH_RESULT_SNIPPET_RE, '')
          .replace(TRUNCATED_SEARCH_HEADER_RE, '');
        for (const url of failedUrls) {
          outcomeText = outcomeText.replaceAll(url, '');
        }
      }

      const stepText = `${paramsText}\n${outcomeText}`;
      if (stepText.includes('modern-web-guidance') && hasGuideSlugMatch(stepText, guideName)) {
        return true;
      }
    }
    return false;
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
    return false;
  }
}

/** True if the file exists and contains every needle. Missing files count as no match. */
function rawFileIncludes(filePath: string, ...needles: string[]): boolean {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return needles.every(n => raw.includes(n));
  } catch (err) {
    if (!isEnoent(err)) throw err;
    return false;
  }
}
