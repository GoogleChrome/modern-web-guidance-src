import fs from 'node:fs';
import { exec, execSync } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

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
 * Asynchronously applies a unified diff patch file to a target directory.
 * Tries git apply first, falling back to standard patch -p1.
 */
export async function applyPatch(targetDir: string, patchPath: string): Promise<PatchResult> {
  if (!fs.existsSync(patchPath)) {
    return { success: false, error: `Patch file not found: ${patchPath}` };
  }
  if (!fs.existsSync(targetDir)) {
    return { success: false, error: `Target directory not found: ${targetDir}` };
  }

  try {
    await execAsync(`git apply --whitespace=nowarn "${patchPath}"`, { cwd: targetDir });
    return { success: true };
  } catch (gitErr: any) {
    try {
      await execAsync(`patch -p1 --no-backup-if-mismatch -i "${patchPath}"`, { cwd: targetDir });
      return { success: true };
    } catch (patchErr: any) {
      const errorMsg = gitErr?.stderr?.toString() || patchErr?.stderr?.toString() || gitErr?.message || patchErr?.message || 'Unknown error applying patch';
      return { success: false, error: errorMsg.trim() };
    }
  }
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

