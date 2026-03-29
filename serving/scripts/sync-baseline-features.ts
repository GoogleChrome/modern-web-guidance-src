/**
 * @file sync-baseline-features.ts
 * @description Extracts and filters the `web-features` dataset (shrinking it to ~400KB),
 * then uses `esbuild` to bundle the source CLI logic (`check-baseline-src.ts`) 
 * with the dataset into a single self-contained script (`check-baseline.js`) 
 * for the automated agent skill folder.
 * 
 * Run via: `pnpm run sync:baseline` from workspace root.
 */

import fs from 'node:fs';
import path from 'node:path';
import { features } from 'web-features';

interface FilteredFeature {
  name: string;
  kind: string;
  status?: {
    baseline?: string;
    baseline_low_date?: string;
    baseline_high_date?: string;
    support?: Record<string, string>;
  };
  redirect_target?: string;
  redirect_targets?: string[];
}

const filtered: Record<string, FilteredFeature> = {};

for (const [id, feature] of Object.entries(features)) {
  filtered[id] = {
    // Keep name for display & debugging context.
    name: feature.name,
    // Keep kind to identify and follow redirects/splits.
    kind: feature.kind,
    // Keep status to determine Baseline readiness (widely vs newly).
    status: feature.status ? {
      baseline: feature.status.baseline,
      baseline_low_date: feature.status.baseline_low_date,
      baseline_high_date: feature.status.baseline_high_date,
      // Keep high-level support profile for single-browser environments (e.g. Electron, intranet).
      // We omit 'by_compat_key' sub-features here to shrink file size from ~7MB to ~400KB.
      support: feature.status.support
    } : undefined,
    // Keep redirect targets to resolve canonical IDs.
    redirect_target: (feature as any).redirect_target,
    redirect_targets: (feature as any).redirect_targets
  };
}

const SKILL_SCRIPTS_DIR = path.join(import.meta.dirname, '../../skills-drafts/baseline/scripts');

// Write to drafts folder for now
const outputPath = path.join(SKILL_SCRIPTS_DIR, 'features.js');

import { execSync } from 'node:child_process';

fs.writeFileSync(outputPath, `export const features = ${JSON.stringify(filtered, null, 2)};\n`);
console.log(`Successfully synced features to ${outputPath}`);

console.log('Bundling check-baseline.js...');
const srcPath = path.join(import.meta.dirname, 'check-baseline-src.ts');
const bundlePath = path.join(SKILL_SCRIPTS_DIR, 'check-baseline.js');

try {
  execSync(`npx esbuild ${srcPath} --bundle --outfile=${bundlePath} --platform=node --alias:web-features=${outputPath}`, { stdio: 'inherit' });
  
  // Post-process to strip source file path comments inserted by esbuild
  const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
  const cleanedContent = bundleContent.replace(/^\/\/ .+\.(ts|js)\n/gm, '');
  fs.writeFileSync(bundlePath, cleanedContent);

  console.log(`Successfully bundled check-baseline.js to ${bundlePath}`);
} catch (error) {
  console.error('Failed to bundle check-baseline.js:', error);
  process.exit(1);
}

// Clean up temporary sidecar used for bundling
try {
  fs.unlinkSync(outputPath);
  console.log('Cleaned up temporary features.js sidecar.');
} catch (err) {
  console.warn(`Warning: Failed to clean up ${outputPath}:`, err);
}
