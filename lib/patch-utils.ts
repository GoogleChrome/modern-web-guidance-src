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
