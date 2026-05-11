#!/usr/bin/env node

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);

if (args[0] === '-y' && args[1] === 'modern-web-guidance@latest') {
  const remainingArgs = args.slice(2);
  const localCliPath = "__LOCAL_CLI_PATH__";

  // Execute the local CLI instead of fetching from registry
  const result = spawnSync(process.execPath, [localCliPath, ...remainingArgs], { stdio: 'inherit' });
  process.exit(result.status ?? 0);
}

// Fallback to real npx
const currentDir = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));

// Find all npx in PATH
const npxPaths = spawnSync('which', ['-a', 'npx'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);

// Find the first one that does not resolve to our shim path
const realNpx = npxPaths.find(p => {
  try {
    return fs.realpathSync(p) !== path.join(currentDir, 'npx');
  } catch {
    return false;
  }
});

if (!realNpx) {
  console.error("Could not find real npx");
  process.exit(1);
}

const env = { ...process.env };
if (env.PATH) {
  const pathDirs = env.PATH.split(path.delimiter);
  env.PATH = pathDirs.filter(d => d !== currentDir).join(path.delimiter);
}

const result = spawnSync(realNpx, args, { stdio: 'inherit', env });
process.exit(result.status ?? 0);
