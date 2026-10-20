import fs from "node:fs";
import path from "node:path";

const SOURCE_CACHE = "/usr/local/google/home/paulirish/.gemini/jetski/brain/72a35306-54fe-4215-ab8a-e40f5a8340fa/scratch/static-cache";
const OUT_DIR = path.resolve(import.meta.dirname, "static-model");
const DIMS = 256;

export function exportStaticModel(sourceDir = SOURCE_CACHE, outDir = OUT_DIR): void {
  const wordsPath = path.join(sourceDir, "teacher-words-q.json");
  const ePath = path.join(sourceDir, "tokenlearn-E.f32");
  const wPath = path.join(sourceDir, "tokenlearn-W.f32");

  if (!fs.existsSync(wordsPath) || !fs.existsSync(ePath) || !fs.existsSync(wPath)) {
    throw new Error(`Source model files missing in ${sourceDir}`);
  }

  const words: string[] = JSON.parse(fs.readFileSync(wordsPath, "utf8"));
  const eBuf = fs.readFileSync(ePath);
  const wBuf = fs.readFileSync(wPath);

  const E = new Float32Array(eBuf.buffer, eBuf.byteOffset, eBuf.byteLength / 4);
  const W = new Float32Array(wBuf.buffer, wBuf.byteOffset, wBuf.byteLength / 4);

  if (E.length !== words.length * DIMS) {
    throw new Error(`Dimension mismatch: E length ${E.length} != words ${words.length} * ${DIMS}`);
  }
  if (W.length !== words.length) {
    throw new Error(`Dimension mismatch: W length ${W.length} != words ${words.length}`);
  }

  const table = new Int8Array(words.length * DIMS);
  const foldedScales = new Float32Array(words.length);

  for (let i = 0; i < words.length; i++) {
    let max = 0;
    const rowOffset = i * DIMS;
    for (let k = 0; k < DIMS; k++) {
      const abs = Math.abs(E[rowOffset + k]);
      if (abs > max) max = abs;
    }
    const scale = max / 127 || 1;
    // Fold per-word trained weight into per-row scale
    foldedScales[i] = scale * W[i];

    for (let k = 0; k < DIMS; k++) {
      table[rowOffset + k] = Math.round(E[rowOffset + k] / scale);
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "words.json"), JSON.stringify(words));
  fs.writeFileSync(path.join(outDir, "words.i8"), Buffer.from(table.buffer));
  fs.writeFileSync(path.join(outDir, "words.scale.f32"), Buffer.from(foldedScales.buffer));

  console.log(`Successfully exported static model to ${outDir}:`);
  console.log(`  words.json: ${words.length} words (${fs.statSync(path.join(outDir, "words.json")).size} bytes)`);
  console.log(`  words.i8: ${table.byteLength} bytes`);
  console.log(`  words.scale.f32: ${foldedScales.byteLength} bytes`);
}

if (process.argv[1] === import.meta.filename) {
  exportStaticModel();
}
