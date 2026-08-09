import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Extracts target modified file paths directly from unified diff headers (+++ b/<path>).
 * Ignores deleted files (/dev/null).
 */
export function extractTargetFilesFromPatch(patchPath: string): string[] {
  try {
    if (!fs.existsSync(patchPath)) return [];
    const content = fs.readFileSync(patchPath, 'utf8');
    const matches = Array.from(content.matchAll(/^\+\+\+ (?:b\/)?(.+)$/gm));
    return matches.map((m) => m[1].trim()).filter((f) => f && f !== '/dev/null');
  } catch (e) {
    console.warn(`Failed to extract target files from patch ${patchPath}: ${e}`);
    return [];
  }
}

export interface PatchResult {
  success: boolean;
  error?: string;
}

/**
 * Synchronously applies a unified diff patch file to a target directory.
 * Tries git apply first, falling back to standard patch -p1.
 */
export function applyPatchSync(targetDir: string, patchPath: string): PatchResult {
  const absPatchPath = path.resolve(patchPath);
  const absTargetDir = path.resolve(targetDir);
  if (!fs.existsSync(absPatchPath)) {
    return { success: false, error: `Patch file not found: ${absPatchPath}` };
  }
  if (!fs.existsSync(absTargetDir)) {
    return { success: false, error: `Target directory not found: ${absTargetDir}` };
  }

  try {
    execSync(`patch -p1 --no-backup-if-mismatch -i "${absPatchPath}"`, { cwd: absTargetDir, stdio: 'pipe' });
    return { success: true };
  } catch (patchErr: any) {
    try {
      execSync(`git apply --whitespace=nowarn --unsafe-paths "${absPatchPath}"`, { cwd: absTargetDir, stdio: 'pipe' });
      return { success: true };
    } catch (gitErr: any) {
      const errorMsg = patchErr?.stderr?.toString() || gitErr?.stderr?.toString() || patchErr?.message || gitErr?.message || 'Unknown error applying patch';
      return { success: false, error: errorMsg.trim() };
    }
  }
}

/**
 * Captures git modifications (both tracked changes and untracked new files) from a working directory
 * into a relative patch file.
 */
export function capturePatchFromGit(
  workDir: string,
  destPatchPath: string,
  relativeSubdir?: string
): { success: boolean; diff: string } {
  try {
    const relFlag = relativeSubdir ? ` --relative="${relativeSubdir}"` : '';
    const targetPath = relativeSubdir ? `"${relativeSubdir}"` : '.';

    // Stage untracked files with intent-to-add so git diff includes them
    execSync(`git add -N --ignore-removal ${targetPath}`, { cwd: workDir, stdio: 'ignore' });

    // Diff against the initial root commit to include any commits made by the agent
    const rootCommit = execSync('git rev-list --max-parents=0 HEAD', { cwd: workDir, encoding: 'utf8' }).trim();
    const diff = execSync(`git diff ${rootCommit}${relFlag} -- ${targetPath}`, { cwd: workDir, encoding: 'utf8' });

    if (!diff.trim()) {
      return { success: false, diff: '' };
    }

    fs.mkdirSync(path.dirname(destPatchPath), { recursive: true });
    fs.writeFileSync(destPatchPath, diff);
    return { success: true, diff };
  } catch (err: any) {
    console.warn(`Failed to capture patch from git in ${workDir}: ${err?.message || err}`);
    return { success: false, diff: '' };
  }
}

/**
 * Initializes a clean git repository in the target directory with an initial commit.
 * Required so git diff / capturePatchFromGit can track modified and new files.
 */
export function initGitRepo(workDir: string): void {
  try {
    execSync('git init && git config user.name "AI" && git config user.email "ai@example.com" && git add . && git commit --allow-empty -m "init"', {
      cwd: workDir,
      stdio: 'ignore'
    });
  } catch (err) {
    console.warn(`Failed to initialize git in workDir ${workDir}: ${err}`);
  }
}

interface EditOp {
  type: 'equal' | 'add' | 'remove';
  oldIndex?: number;
  newIndex?: number;
  line: string;
}

/**
 * Generates an aligned LCS unified diff of two strings for LLM context and file comparison.
 * Trims common prefix and suffix to avoid quadratic allocations on large files.
 */
export function generateUnifiedDiff(
  oldText: string,
  newText: string,
  oldLabel = 'Old',
  newLabel = 'New',
  contextLines = 3
): string {
  if (oldText === newText) {
    return 'No differences detected.';
  }

  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  // 1. Trim common prefix
  let prefixCount = 0;
  while (
    prefixCount < oldLines.length &&
    prefixCount < newLines.length &&
    oldLines[prefixCount] === newLines[prefixCount]
  ) {
    prefixCount++;
  }

  // 2. Trim common suffix
  let suffixCount = 0;
  while (
    suffixCount < oldLines.length - prefixCount &&
    suffixCount < newLines.length - prefixCount &&
    oldLines[oldLines.length - 1 - suffixCount] === newLines[newLines.length - 1 - suffixCount]
  ) {
    suffixCount++;
  }

  const midOld = oldLines.slice(prefixCount, oldLines.length - suffixCount);
  const midNew = newLines.slice(prefixCount, newLines.length - suffixCount);
  const m = midOld.length;
  const n = midNew.length;

  const ops: EditOp[] = [];

  // Add prefix equal ops
  for (let i = 0; i < prefixCount; i++) {
    ops.push({ type: 'equal', oldIndex: i + 1, newIndex: i + 1, line: oldLines[i] });
  }

  // Compute LCS on diverging middle lines
  if (m > 0 || n > 0) {
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (midOld[i - 1] === midNew[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const midOps: EditOp[] = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && midOld[i - 1] === midNew[j - 1]) {
        midOps.push({
          type: 'equal',
          oldIndex: prefixCount + i,
          newIndex: prefixCount + j,
          line: midOld[i - 1]
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        midOps.push({
          type: 'add',
          newIndex: prefixCount + j,
          line: midNew[j - 1]
        });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        midOps.push({
          type: 'remove',
          oldIndex: prefixCount + i,
          line: midOld[i - 1]
        });
        i--;
      }
    }
    midOps.reverse();
    ops.push(...midOps);
  }

  // Add suffix equal ops
  const suffixOldStart = oldLines.length - suffixCount;
  const suffixNewStart = newLines.length - suffixCount;
  for (let i = 0; i < suffixCount; i++) {
    ops.push({
      type: 'equal',
      oldIndex: suffixOldStart + i + 1,
      newIndex: suffixNewStart + i + 1,
      line: oldLines[suffixOldStart + i]
    });
  }

  if (ops.every((op) => op.type === 'equal')) {
    return 'No differences detected.';
  }

  // Generate unified diff hunks
  const hunks: {
    oldStart: number;
    oldLinesCount: number;
    newStart: number;
    newLinesCount: number;
    lines: string[];
  }[] = [];

  let opIndex = 0;
  while (opIndex < ops.length) {
    while (opIndex < ops.length && ops[opIndex].type === 'equal') {
      opIndex++;
    }
    if (opIndex >= ops.length) break;

    const hunkStart = Math.max(0, opIndex - contextLines);
    let hunkEnd = opIndex;

    while (hunkEnd < ops.length) {
      if (ops[hunkEnd].type !== 'equal') {
        hunkEnd++;
      } else {
        let nextChange = hunkEnd;
        while (nextChange < ops.length && ops[nextChange].type === 'equal' && nextChange - hunkEnd < 2 * contextLines) {
          nextChange++;
        }
        if (nextChange < ops.length && ops[nextChange].type !== 'equal') {
          hunkEnd = nextChange;
        } else {
          break;
        }
      }
    }

    const actualEnd = Math.min(ops.length - 1, hunkEnd + contextLines - 1);
    const hunkOps = ops.slice(hunkStart, actualEnd + 1);

    let oldStart = 0;
    let newStart = 0;
    let oldLinesCount = 0;
    let newLinesCount = 0;
    const lines: string[] = [];

    for (const op of hunkOps) {
      if (op.oldIndex !== undefined && oldStart === 0) oldStart = op.oldIndex;
      if (op.newIndex !== undefined && newStart === 0) newStart = op.newIndex;

      if (op.type === 'equal') {
        oldLinesCount++;
        newLinesCount++;
        lines.push(`  ${op.line}`);
      } else if (op.type === 'remove') {
        oldLinesCount++;
        lines.push(`- ${op.line}`);
      } else if (op.type === 'add') {
        newLinesCount++;
        lines.push(`+ ${op.line}`);
      }
    }

    if (oldStart === 0) oldStart = 1;
    if (newStart === 0) newStart = 1;

    hunks.push({ oldStart, oldLinesCount, newStart, newLinesCount, lines });
    opIndex = actualEnd + 1;
  }

  let result = `--- ${oldLabel}\n+++ ${newLabel}\n`;
  for (const hunk of hunks) {
    result += `@@ -${hunk.oldStart},${hunk.oldLinesCount} +${hunk.newStart},${hunk.newLinesCount} @@\n`;
    result += hunk.lines.join('\n') + '\n';
  }
  return result.trim();
}
