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
  if (!fs.existsSync(patchPath)) {
    return { success: false, error: `Patch file not found: ${patchPath}` };
  }
  if (!fs.existsSync(targetDir)) {
    return { success: false, error: `Target directory not found: ${targetDir}` };
  }

  try {
    execSync(`git apply --whitespace=nowarn "${patchPath}"`, { cwd: targetDir, stdio: 'pipe' });
    return { success: true };
  } catch (gitErr: any) {
    try {
      execSync(`patch -p1 --no-backup-if-mismatch -i "${patchPath}"`, { cwd: targetDir, stdio: 'pipe' });
      return { success: true };
    } catch (patchErr: any) {
      const errorMsg = gitErr?.stderr?.toString() || patchErr?.stderr?.toString() || gitErr?.message || patchErr?.message || 'Unknown error applying patch';
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

    // Ensure untracked files are recognized by git diff
    execSync(`git add -N --ignore-removal ${targetPath}`, { cwd: workDir, stdio: 'ignore' });
    const diff = execSync(`git diff${relFlag} ${targetPath}`, { cwd: workDir, encoding: 'utf8' });

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
