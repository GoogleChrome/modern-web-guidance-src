import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { getTaskMap, TARGETS_DIR, ZERO_PASSRATE_PATCH_FILE, type TaskInfo } from '../core/guide-validation.ts';
import { baseAppsDir } from '../core/paths.ts';
import { applyPatchSync } from '../core/patch-utils.ts';
import { copyBaseAppToWorkspace } from '../harness/lib/utils.ts';
import { startTargetServer, type TargetServer } from '../grading/target-server.ts';

export interface PreviewTarget {
  patchFile: string;
  baseApp: string;
  zeroPassrateFile: string;
}

/** Resolve the app from registered task metadata, not the patch filename. */
export function resolvePreviewTarget(
  patch: string,
  tasks: ReadonlyMap<string, TaskInfo> = getTaskMap(),
): PreviewTarget {
  const patchFile = path.resolve(patch);
  if (!patchFile.endsWith('.patch') || !fs.existsSync(patchFile) || !fs.statSync(patchFile).isFile()) {
    throw new Error(`Expected an existing .patch file: ${patchFile}`);
  }
  const patchDir = path.dirname(patchFile);
  for (const [key, task] of tasks) {
    const taskName = key.slice(key.indexOf('/') + 1);
    const targetDir = path.resolve(task.guideDir, TARGETS_DIR, taskName);
    const zeroPassrateFile = path.join(targetDir, ZERO_PASSRATE_PATCH_FILE);
    if (patchDir === path.dirname(zeroPassrateFile)) {
      return { patchFile, baseApp: task.baseApp, zeroPassrateFile };
    }
  }
  throw new Error(`No registered guide target found for ${patchFile}. Use a patch inside a guide's targets/<target>/patches directory.`);
}

/** Stage and serve a copy, using the same baseline-before-solution order as grading. */
export async function startPatchPreview(target: PreviewTarget): Promise<TargetServer & { workDir: string }> {
  if (!fs.existsSync(path.join(baseAppsDir, target.baseApp))) {
    throw new Error(`Base app not found: ${target.baseApp}`);
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-preview-'));
  const workDir = path.join(tempDir, 'app');
  const cleanup = () => fs.rmSync(tempDir, { recursive: true, force: true });
  try {
    await copyBaseAppToWorkspace(target.baseApp, workDir);
    const patches = target.patchFile === target.zeroPassrateFile
      ? [target.patchFile]
      : [target.zeroPassrateFile, target.patchFile];
    for (const patchFile of patches) {
      if (patchFile === target.zeroPassrateFile && !fs.existsSync(patchFile)) continue;
      if (!fs.readFileSync(patchFile, 'utf8').trim()) continue;
      const result = applyPatchSync(workDir, patchFile);
      if (!result.success) throw new Error(`Failed to apply ${patchFile}: ${result.error}`);
    }
    const server = await startTargetServer(workDir, { exportTargetUrlEnv: false });
    let stopping: Promise<void> | undefined;
    return {
      url: server.url,
      workDir,
      stop: () => stopping ??= (async () => {
        try { await server.stop(); } finally { cleanup(); }
      })(),
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

export async function previewPatch(patch: string): Promise<void> {
  const target = resolvePreviewTarget(patch);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let preview: Awaited<ReturnType<typeof startPatchPreview>> | undefined;
  try {
    preview = await startPatchPreview(target);
    if (!controller.signal.aborted) {
      console.log(`Preview: ${preview.url}\nPress Ctrl+C to stop and remove the temporary app.`);
      await once(controller.signal, 'abort');
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await preview?.stop();
  }
}
