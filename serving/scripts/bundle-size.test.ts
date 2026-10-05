import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getPackageName, measureDirectory } from "./bundle-size.ts";

test("getPackageName correctly extracts package identities", () => {
  assert.equal(getPackageName("serving/lib/search.ts"), "serving/lib");
  assert.equal(getPackageName("constants.ts"), "serving/lib");
  assert.equal(getPackageName("node_modules/marked/lib/marked.esm.js"), "marked");
  assert.equal(getPackageName("node_modules/@tensorflow/tfjs-core/dist/index.js"), "@tensorflow/tfjs-core");
  assert.equal(
    getPackageName("node_modules/.pnpm/@tensorflow+tfjs-core@4.22.0_encoding@0.1.13/tfjs-core/src/ops/real.ts"),
    "@tensorflow/tfjs-core"
  );
  assert.equal(
    getPackageName("node_modules/.pnpm/tfjs-core/src/ops/real.ts"),
    "@tensorflow/tfjs-core"
  );
  assert.equal(
    getPackageName("node_modules/.pnpm/@tensorflow+tfjs-backend-cpu@4.22.0/tfjs-backend-cpu/src/index.ts"),
    "@tensorflow/tfjs-backend-cpu"
  );
  assert.equal(
    getPackageName("node_modules/.pnpm/@tensorflow+tfjs-core@4.22.0_encoding@0.1.13/node_modules/tslib/tslib.es6.js"),
    "tslib"
  );
  assert.equal(
    getPackageName("node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/src/tokenizers.js"),
    "@huggingface/transformers"
  );
});

test("measureDirectory decodes search.mjs with strict file size reconciliation", () => {
  const distDir = path.resolve(import.meta.dirname, "../../dist/skills-cli");
  if (!fs.existsSync(distDir)) {
    return;
  }
  const snapshot = measureDirectory(distDir);
  assert.ok(snapshot.searchBundle.rawBytes > 0);
  assert.ok(snapshot.searchBundle.gzipBytes > 0);
  assert.ok(snapshot.searchBundle.packages["@tensorflow/tfjs-core"] > 0);
  assert.ok(snapshot.searchBundle.packages["<unmapped/license>"] > 0);

  const totalPkgBytes = Object.values(snapshot.searchBundle.packages).reduce((a, b) => a + b, 0);
  assert.equal(totalPkgBytes, snapshot.searchBundle.rawBytes);
});
