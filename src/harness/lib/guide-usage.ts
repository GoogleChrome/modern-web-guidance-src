import fs from 'fs';
import path from 'path';
import { isEnoent, parseJsonlFile, type GuideUsage } from './agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../core/constants.ts';

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
  const logExists = fs.existsSync(path.join(dir, MODERN_WEB_LOG_FILE));
  if (logExists && !toolsUsed.includes(GUIDANCE_TOOL_NAME)) {
    toolsUsed.push(GUIDANCE_TOOL_NAME);
  }
  return toolsUsed;
}

/**
 * Checks whether a trajectory contains both `modern-web-guidance` and the expected `guideName`.
 */
export function hasTrajectoryGuideLeak(dir: string, guideName: string): boolean {
  if (!guideName) return false;
  return (
    rawFileIncludes(path.join(dir, SUMMARY_FILE), GUIDANCE_TOOL_NAME, guideName) ||
    rawFileIncludes(path.join(dir, MODERN_WEB_LOG_FILE), guideName)
  );
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
