import fs from 'fs';
import path from 'path';
import { isEnoent, type GuideUsage } from './agent-shared.ts';
import { extractWebRunsFromText } from '../agents/codex-cli-agent.ts';
import type { TrajectorySummary } from './trajectory-normalizer.ts';

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

export async function collectGuidesUsed(dirPath: string): Promise<GuideUsage> {
  const summaryPath = path.join(dirPath, 'trajectory_summary.json');
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    if (Array.isArray(summary.retrievedGuides) || Array.isArray(summary.fileReadGuides)) {
      return {
        retrievedGuides: summary.retrievedGuides || [],
        fileReadGuides: summary.fileReadGuides || []
      };
    }
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
  }
  return { retrievedGuides: [], fileReadGuides: [] };
}

export async function collectGuidanceToolsUsed(dir: string): Promise<string[]> {
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    if (Array.isArray(summary.toolsUsed)) {
      return summary.toolsUsed;
    }
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
  }
  return [];
}

/**
 * Checks whether a trajectory contains both `modern-web-guidance` and the expected `guideName`,
 * evaluating `trajectory_summary.json` per step and excluding host `node_modules` paths and
 * passive web-search queries/snippets where a guide URL was never opened.
 */
export function hasTrajectoryGuideLeak(dir: string, guideName: string): boolean {
  if (!guideName) return false;
  const summaryPath = path.join(dir, 'trajectory_summary.json');
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


