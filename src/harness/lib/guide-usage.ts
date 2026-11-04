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

function isSearchOnlyWebRun(call: string): boolean {
  return /["']?\bsearch_query["']?\s*:/.test(call) && !/["']?\bopen["']?\s*:/.test(call);
}

function stripHostNodeModules(text: string): string {
  return text.replace(HOST_NODE_MODULES_RE, '');
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

      const webRuns = Array.isArray(rawParams?.webRuns)
        ? rawParams.webRuns.filter((r): r is string => typeof r === 'string')
        : typeof rawParams?.value === 'string' && rawParams.value.includes('tools.web__run')
          ? extractWebRunsFromText(rawParams.value)
          : [];

      const isSearchOnlyWebStep =
        (webRuns.length > 0 && webRuns.every(isSearchOnlyWebRun)) ||
        (step?.action?.name === 'web_search' && rawParams?.type === 'search' && !rawParams?.url);

      let paramsText = '';
      if (rawParams) {
        const filteredParams: Record<string, unknown> = { ...rawParams };
        if (Array.isArray(filteredParams.webRuns)) {
          filteredParams.webRuns = (filteredParams.webRuns as unknown[]).filter(
            (r) => typeof r !== 'string' || !isSearchOnlyWebRun(r)
          );
        }
        if (typeof filteredParams.value === 'string' && webRuns.length > 0) {
          let val = filteredParams.value;
          for (const r of webRuns) {
            if (isSearchOnlyWebRun(r)) {
              val = val.replace(r, '');
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
      if (!isSearchOnlyWebStep && typeof step?.outcome?.message === 'string') {
        outcomeText = stripHostNodeModules(step.outcome.message)
          .replace(SEARCH_RESULT_SNIPPET_RE, '')
          .replace(TRUNCATED_SEARCH_HEADER_RE, '');
      }

      const stepText = `${paramsText}\n${outcomeText}`;
      if (stepText.includes('modern-web-guidance') && stepText.includes(guideName)) {
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
