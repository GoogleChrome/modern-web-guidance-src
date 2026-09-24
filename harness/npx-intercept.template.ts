#!/usr/bin/env node

/**
 * @file npx-intercept.template.ts
 * @description This script acts as a shim for `npx` during evaluations.
 * It intercepts calls to `npx -y modern-web-guidance@latest` and redirects them
 * to the local build in `dist/skills-cli`, ensuring that agents use the fresh
 * local guides instead of fetching the published package from the npm registry.
 * All other `npx` calls fall back to the real system `npx`.
 */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const invokedBin = path.basename(process.argv[1] || 'npx');
const args = process.argv.slice(2);
const normalizedArgs = (args[0] === '-y' || args[0] === 'dlx') ? args.slice(1) : args;

if (normalizedArgs[0] === 'modern-web-guidance@latest') {
  const remainingArgs = normalizedArgs.slice(1);
  const localCliPath = "__LOCAL_CLI_PATH__";

  // Execute the local CLI instead of fetching from registry
  const result = spawnSync(process.execPath, [localCliPath, ...remainingArgs], { stdio: 'inherit' });
  process.exit(result.status ?? 0);
}

// Fallback to real binary (npx, pnpx, or pnpm)
const currentDir = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));

// Find all matching binaries in PATH
const binPaths = spawnSync('which', ['-a', invokedBin], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);

// Find the first one that does not resolve to our shim directory
const realBin = binPaths.find(p => {
  try {
    return path.dirname(fs.realpathSync(p)) !== currentDir;
  } catch {
    return false;
  }
});

if (!realBin) {
  console.error(`Could not find real ${invokedBin}`);
  process.exit(1);
}

const env = { ...process.env };
if (env.PATH) {
  const pathDirs = env.PATH.split(path.delimiter);
  env.PATH = pathDirs.filter(d => d !== currentDir).join(path.delimiter);
}

const result = spawnSync(realBin, args, { stdio: 'inherit', env });
process.exit(result.status ?? 0);

