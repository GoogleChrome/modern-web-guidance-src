import path from 'node:path';
import { outDir, rootDir } from '../../core/paths.ts';
import { buildDist, getLatestVersion } from '../../build/build-dist.ts';
import { embedGuideChunks } from '../../rag/embed-guide-chunks.ts';
import { DEFAULT_CACHE_DIR } from '../../rag/guide-chunk-cache.ts';

export const EVAL_CHUNK_CACHE_DIR = path.join(outDir, 'eval', 'chunk-cache');

export interface EnsureGuidedEvalDistDeps {
  embedChunks?: typeof embedGuideChunks;
  runBuildDist?: typeof buildDist;
  getVersion?: () => string;
  evalCacheDir?: string;
  defaultCacheDir?: string;
  publishRoot?: string;
}

/**
 * Ensures all published skills-cli guide chunks have teacher vectors before
 * guided eval runs, embedding any uncached chunks into an eval-scoped cache
 * under `out/` so `src/rag/gen/` stays clean. Fails loudly if chunks are
 * missing and `GEMINI_API_KEY` is unavailable.
 */
export async function ensureGuidedEvalDist(deps: EnsureGuidedEvalDistDeps = {}): Promise<{
  chunkCacheDir: string;
  embeddedNewChunks: number;
}> {
  const embedChunks = deps.embedChunks ?? embedGuideChunks;
  const runBuildDist = deps.runBuildDist ?? buildDist;
  const getVersion = deps.getVersion ?? getLatestVersion;
  const evalCacheDir = deps.evalCacheDir ?? EVAL_CHUNK_CACHE_DIR;
  const defaultCacheDir = deps.defaultCacheDir ?? DEFAULT_CACHE_DIR;
  const publishRoot = deps.publishRoot ?? path.join(rootDir, 'dist', 'skills-cli');

  const baseCheck = await embedChunks({ check: true, cacheDir: defaultCacheDir });
  let chunkCacheDir = defaultCacheDir;
  let embeddedNewChunks = 0;

  if (baseCheck.missing.length > 0) {
    const missingGuides = [...new Set(baseCheck.missing.map((c) => c.guideId))];
    const relCacheDir = path.relative(rootDir, evalCacheDir);
    const cacheLabel = relCacheDir.startsWith('..') ? evalCacheDir : relCacheDir;
    console.log(
      `Found ${baseCheck.missing.length} uncached chunk(s) across ${missingGuides.length} guide(s) (${missingGuides.join(', ')}); preparing eval chunk cache at ${cacheLabel}...`
    );
    const embedResult = await embedChunks({
      cacheDir: evalCacheDir,
      seedCacheDir: defaultCacheDir,
      prune: true,
    });
    chunkCacheDir = evalCacheDir;
    embeddedNewChunks = embedResult.newEmbeds;
  }

  let version: string | undefined;
  try {
    version = getVersion() || undefined;
  } catch {
    // Tagless or non-git checkouts still produce a valid skills-cli dist.
  }

  await runBuildDist({
    publishRoot,
    version,
    failOnMissingVectors: true,
    chunkCacheDir,
  });

  return { chunkCacheDir, embeddedNewChunks };
}
