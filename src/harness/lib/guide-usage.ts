import fs from 'fs';
import path from 'path';
import { isEnoent, type GuideUsage } from './agent-shared.ts';

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
 * Checks whether a trajectory contains both `modern-web-guidance` and the expected `guideName`.
 */
export function hasTrajectoryGuideLeak(dir: string, guideName: string): boolean {
  if (!guideName) return false;
  const summaryPath = path.join(dir, 'trajectory_summary.json');
  try {
    const raw = fs.readFileSync(summaryPath, 'utf8');
    return raw.includes('modern-web-guidance') && raw.includes(guideName);
  } catch (err) {
    if (!isEnoent(err) && !(err instanceof SyntaxError)) throw err;
    return false;
  }
}


