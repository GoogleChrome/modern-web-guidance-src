import esbuild from 'esbuild';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const testFile = path.join(ROOT_DIR, 'lib/tfjs-embedder.test.ts');
const outFile = path.join(ROOT_DIR, 'build/tfjs-embedder.test.mjs');

async function main() {
  console.log('Bundling test file...');
  await esbuild.build({
    entryPoints: [testFile],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    banner: {
      js: `import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);`,
    },
    external: ['onnxruntime-node', 'sharp', 'iconv-lite'],
    sourcemap: true,
  });

  // Copy model to build dir for test
  const modelSrc = path.join(ROOT_DIR, 'lib/tfjs_model_minilm');
  const modelDest = path.join(ROOT_DIR, 'build/tfjs_model_minilm');
  fs.cpSync(modelSrc, modelDest, { recursive: true });

  console.log('Running test...');
  try {
    execSync(`node --test ${outFile}`, { stdio: 'inherit' });
    console.log('Test completed successfully!');
  } catch (e) {
    console.error('Test failed!');
    process.exit(1);
  } finally {
    // Clean up
    if (fs.existsSync(outFile)) {
      fs.unlinkSync(outFile);
    }
    const mapFile = `${outFile}.map`;
    if (fs.existsSync(mapFile)) {
      fs.unlinkSync(mapFile);
    }
    const modelDest = path.join(ROOT_DIR, 'build/tfjs_model_minilm');
    if (fs.existsSync(modelDest)) {
      fs.rmSync(modelDest, { recursive: true, force: true });
    }
  }
}

main().catch(console.error);
