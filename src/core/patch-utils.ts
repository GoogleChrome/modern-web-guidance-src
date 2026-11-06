import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createTwoFilesPatch } from 'diff';
import { gitExec } from './git-utils.ts';

const MAX_BUFFER = 50 * 1024 * 1024; // 50MB buffer to handle large diffs/assets

const EXCLUDED_FILES_RE = /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|guide\.md|expectations\.md|task\.md|pnpm-workspace\.yaml)$/;

const EXCLUDED_PATCH_PATHSPECS = [
  ':(exclude)package-lock.json',
  ':(exclude)**/package-lock.json',
  ':(exclude)pnpm-lock.yaml',
  ':(exclude)**/pnpm-lock.yaml',
  ':(exclude)yarn.lock',
  ':(exclude)**/yarn.lock',
  ':(exclude)bun.lockb',
  ':(exclude)**/bun.lockb',
  ':(exclude)bun.lock',
  ':(exclude)**/bun.lock',
  ':(exclude)guide.md',
  ':(exclude)**/guide.md',
  ':(exclude)expectations.md',
  ':(exclude)**/expectations.md',
  ':(exclude)task.md',
  ':(exclude)**/task.md',
  ':(exclude)pnpm-workspace.yaml',
  ':(exclude)**/pnpm-workspace.yaml',
];

/**
 * Extracts target modified file paths directly from unified diff headers (+++ b/<path>).
 * Ignores deleted files (/dev/null), package manager lockfiles, and authoring metadata files.
 */
export function extractTargetFilesFromPatch(patchPath: string): string[] {
  try {
    if (!fs.existsSync(patchPath)) return [];
    const content = fs.readFileSync(patchPath, 'utf8');
    const matches = Array.from(content.matchAll(/^\+\+\+ (?:b\/)?(.+)$/gm));
    return matches
      .map((m) => m[1].trim())
      .filter((filePath) => filePath && filePath !== '/dev/null' && !EXCLUDED_FILES_RE.test(filePath));
  } catch (e) {
    console.warn(`Failed to extract target files from patch ${patchPath}: ${e}`);
    return [];
  }
}

export interface PatchResult {
  success: boolean;
  error?: string;
}

function applyWithGit(absTargetDir: string, absPatchPath: string): void {
  const realTargetDir = fs.realpathSync(absTargetDir);
  const ceilingDirs = Array.from(
    new Set([path.dirname(absTargetDir), path.dirname(realTargetDir)]),
  ).join(path.delimiter);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CEILING_DIRECTORIES: ceilingDirs,
  };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;

  execSync(`git apply --check --binary --whitespace=nowarn --unsafe-paths "${absPatchPath}"`, {
    cwd: absTargetDir,
    env,
    stdio: 'pipe',
    maxBuffer: MAX_BUFFER,
  });
  execSync(`git apply --binary --whitespace=nowarn --unsafe-paths "${absPatchPath}"`, {
    cwd: absTargetDir,
    env,
    stdio: 'pipe',
    maxBuffer: MAX_BUFFER,
  });
}

/**
 * Synchronously applies a unified diff patch file to a target directory.
 * Verifies with a dry-run first so rejected hunks never leave a silent partial apply.
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

  const patchContent = fs.readFileSync(absPatchPath, 'utf8');
  const binaryDifferMatch = patchContent.match(/^Binary files .+ and .+ differ$/m);
  if (binaryDifferMatch) {
    return {
      success: false,
      error: `Patch contains binary diff without content (${binaryDifferMatch[0]}); capture with git diff --binary`,
    };
  }

  if (/^GIT binary patch$/m.test(patchContent)) {
    try {
      applyWithGit(absTargetDir, absPatchPath);
      return { success: true };
    } catch (gitErr: any) {
      const errorMsg =
        [gitErr?.stderr?.toString()?.trim(), gitErr?.stdout?.toString()?.trim()]
          .filter(Boolean)
          .join('\n') ||
        gitErr?.message ||
        'Unknown error applying binary patch';
      return { success: false, error: errorMsg.trim() };
    }
  }

  let dryRunDiagnostic = '';
  try {
    const dryOut = execSync(`patch -p1 --dry-run --batch --forward -i "${absPatchPath}"`, {
      cwd: absTargetDir,
      stdio: 'pipe',
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
    });
    if (/\bFAILED\b|\bignored\b/i.test(dryOut)) {
      dryRunDiagnostic = dryOut.trim();
      throw new Error(dryRunDiagnostic);
    }
    execSync(`patch -p1 --no-backup-if-mismatch --batch --forward -r - -i "${absPatchPath}"`, {
      cwd: absTargetDir,
      stdio: 'pipe',
      maxBuffer: MAX_BUFFER,
    });
    return { success: true };
  } catch (patchErr: any) {
    if (!dryRunDiagnostic) {
      dryRunDiagnostic = [
        patchErr?.stdout?.toString()?.trim(),
        patchErr?.stderr?.toString()?.trim(),
      ]
        .filter(Boolean)
        .join('\n');
    }
    try {
      applyWithGit(absTargetDir, absPatchPath);
      return { success: true };
    } catch (gitErr: any) {
      const errorParts = [
        dryRunDiagnostic,
        gitErr?.stderr?.toString()?.trim(),
        gitErr?.stdout?.toString()?.trim(),
      ].filter(Boolean);
      const errorMsg =
        errorParts.join('\n') ||
        patchErr?.message ||
        gitErr?.message ||
        'Unknown error applying patch';
      return { success: false, error: errorMsg.trim() };
    }
  }
}

/**
 * Captures git modifications (both tracked changes and untracked new files) from a working directory
 * into a relative patch file, excluding package manager lockfiles.
 *
 * Streams the binary diff straight to destPatchPath using git's --output flag to avoid child_process
 * buffer limits on large binary payloads.
 *
 * @throws {Error} If git fails to capture the patch (e.g. non-git directory or git error).
 * @returns {{ success: boolean }} true if non-empty patch was captured; false if working tree was clean.
 */
export function capturePatchFromGit(
  workDir: string,
  destPatchPath: string,
  relativeSubdir?: string
): { success: boolean } {
  const absDestPatch = path.resolve(destPatchPath);
  try {
    const targetPath = relativeSubdir || '.';

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    delete env.GIT_INDEX_FILE;

    fs.mkdirSync(path.dirname(absDestPatch), { recursive: true });

    // Stage untracked files with intent-to-add so git diff includes them
    gitExec(['add', '-N', '--ignore-removal', '--', targetPath], {
      cwd: workDir,
      isolated: true,
      env,
      stdio: 'ignore',
    });

    // Diff against the initial root commit to include any commits made by the agent
    const rootCommit = gitExec(['rev-list', '--max-parents=0', 'HEAD'], {
      cwd: workDir,
      isolated: true,
      env,
      maxBuffer: MAX_BUFFER,
    }).trim();

    if (!rootCommit) {
      throw new Error(`Failed to determine root commit in ${workDir}`);
    }

    gitExec(
      [
        'diff',
        '--binary',
        `--output=${absDestPatch}`,
        rootCommit,
        ...(relativeSubdir ? [`--relative=${relativeSubdir}`] : []),
        '--',
        targetPath,
        ...EXCLUDED_PATCH_PATHSPECS,
      ],
      { cwd: workDir, isolated: true, env, maxBuffer: MAX_BUFFER }
    );

    if (!fs.existsSync(absDestPatch) || fs.statSync(absDestPatch).size === 0) {
      if (fs.existsSync(absDestPatch)) {
        fs.unlinkSync(absDestPatch);
      }
      return { success: false };
    }

    return { success: true };
  } catch (err: any) {
    if (fs.existsSync(absDestPatch)) {
      try {
        fs.unlinkSync(absDestPatch);
      } catch {}
    }
    const msg = err?.stderr?.toString()?.trim() || err?.stdout?.toString()?.trim() || err?.message || String(err);
    throw new Error(`Failed to capture patch from git in ${workDir}: ${msg}`, { cause: err });
  }
}

/**
 * Initializes a clean git repository in the target directory with an initial commit.
 * Required so git diff / capturePatchFromGit can track modified and new files.
 */
export function initGitRepo(workDir: string): void {
  try {
    const opts = { cwd: workDir, isolated: true, stdio: 'ignore' as const };
    gitExec(['init', '-q'], opts);
    gitExec(['config', 'user.name', 'AI'], opts);
    gitExec(['config', 'user.email', 'ai@example.com'], opts);
    gitExec(['add', '.'], opts);
    gitExec(['commit', '-q', '--allow-empty', '-m', 'init'], opts);
  } catch (err) {
    console.warn(`Failed to initialize git in workDir ${workDir}: ${err}`);
  }
}

/**
 * Generates an aligned unified diff of two strings for LLM context and file comparison.
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

  const patch = createTwoFilesPatch(oldLabel, newLabel, oldText, newText, undefined, undefined, { context: contextLines });
  if (!patch.includes('@@')) {
    return 'No differences detected.';
  }
  return patch.trim();
}
