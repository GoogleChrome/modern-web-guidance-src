import * as esbuild from 'esbuild';
import fsPromises from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');

async function buildGpt4all() {
  console.log('Building gpt4all standalone...');
  const outdir = path.join(DIST_DIR, 'gpt4all');
  await fsPromises.mkdir(outdir, { recursive: true });

  // esbuild
  await esbuild.build({
    entryPoints: ['test-gpt4all.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: path.join(outdir, 'cli.mjs'),
    // We mark gpt4all as external because it relies on native binaries 
    // and complex resolution that esbuild struggles with statically.
    external: ['gpt4all'],
  });

  // To make it truly standalone, we need to copy the localized gpt4all package
  // so it can find its runtimes.
  const targetNodeModules = path.join(outdir, 'node_modules');
  await fsPromises.mkdir(targetNodeModules, { recursive: true });
  await fsPromises.cp(
    path.join(__dirname, 'node_modules/gpt4all'),
    path.join(targetNodeModules, 'gpt4all'),
    { recursive: true }
  );
  // gpt4all also depends on node-gyp-build and md5-file at runtime
  await fsPromises.cp(
    path.join(__dirname, 'node_modules/node-gyp-build'),
    path.join(targetNodeModules, 'node-gyp-build'),
    { recursive: true }
  );
  await fsPromises.cp(
    path.join(__dirname, 'node_modules/md5-file'),
    path.join(targetNodeModules, 'md5-file'),
    { recursive: true }
  );

  console.log('  -> done gpt4all');
}

async function buildTransformersWasm() {
  console.log('Building transformers-wasm standalone...');
  const outdir = path.join(DIST_DIR, 'transformers-wasm');
  await fsPromises.mkdir(outdir, { recursive: true });

  // esbuild
  await esbuild.build({
    entryPoints: ['test-transformers-wasm.ts'],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: path.join(outdir, 'cli.mjs'),
    // Force usage of the web version of onnxruntime to avoid native binaries
    // Alias sharp to a mock file so ESM loader doesn't crash on unresolved module
    alias: {
      'onnxruntime-node': 'onnxruntime-web',
      'sharp': path.join(__dirname, 'mock-sharp.js')
    }
  });

  // Since we are forcing 'onnxruntime-web', we might need to supply the local WASM files
  // if we don't want it falling back to the CDN. Let's copy them just in case.
  const wasmDest = path.join(outdir, 'wasm');
  await fsPromises.mkdir(wasmDest, { recursive: true });
  await fsPromises.cp(
    path.join(__dirname, 'node_modules/onnxruntime-web/dist'),
    wasmDest,
    { recursive: true, filter: (src) => src.endsWith('.wasm') || src.endsWith('.mjs') || src.endsWith('.js') || fs.statSync(src).isDirectory() }
  );

  console.log('  -> done transformers-wasm');
}

async function main() {
  await fsPromises.rm(DIST_DIR, { recursive: true, force: true }).catch(() => {});
  
  await buildGpt4all();
  await buildTransformersWasm();
  
  console.log('\\nBuild complete. Test with:');
  console.log('  node ../dist/gpt4all/cli.mjs');
  console.log('  node ../dist/transformers-wasm/cli.mjs');
}

main().catch(console.error);
