import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getPackageName,
  decodeMetafileBreakdown,
  measureDirectory,
  buildScopedPackageMap,
  resolveBarePackageName,
} from "./bundle-size.ts";

test("decodeMetafileBreakdown aggregates inputs and reconciles bytes", () => {
  const metafile = {
    outputs: {
      "dist/search.mjs": {
        bytes: 100,
        inputs: {
          "node_modules/marked/index.js": { bytesInOutput: 40 },
          "serving/lib/search.ts": { bytesInOutput: 50 },
        },
      },
    },
  };
  const { packages, totalAccounted } = decodeMetafileBreakdown(metafile, 100);
  assert.equal(totalAccounted, 100);
  assert.equal(packages["marked"], 40);
  assert.equal(packages["serving/lib"], 50);
  assert.equal(packages["<unmapped/license>"], 10);
});

test("getPackageName correctly extracts package identities", () => {
  assert.equal(getPackageName("serving/lib/search.ts"), "serving/lib");
  assert.equal(getPackageName("constants.ts"), "serving/lib");
  assert.equal(getPackageName("node_modules/marked/lib/marked.esm.js"), "marked");
  assert.equal(getPackageName("node_modules/@tensorflow/tfjs-core/dist/index.js"), "@tensorflow/tfjs-core");

  // @tensorflow/tfjs-core source path shapes (versioned pnpm dir and chained bare input sourcemap dir)
  assert.equal(
    getPackageName("node_modules/.pnpm/@tensorflow+tfjs-core@4.22.0_encoding@0.1.13/tfjs-core/src/ops/real.ts"),
    "@tensorflow/tfjs-core"
  );
  assert.equal(
    getPackageName("node_modules/.pnpm/tfjs-core/src/ops/real.ts"),
    "@tensorflow/tfjs-core"
  );

  // @tensorflow/tfjs-converter source path shapes
  assert.equal(
    getPackageName("node_modules/.pnpm/@tensorflow+tfjs-converter@4.22.0/tfjs-converter/src/index.ts"),
    "@tensorflow/tfjs-converter"
  );
  assert.equal(
    getPackageName("node_modules/.pnpm/tfjs-converter/src/operations/op_list/arithmetic.ts"),
    "@tensorflow/tfjs-converter"
  );

  // @tensorflow/tfjs-backend-cpu source path shapes
  assert.equal(
    getPackageName("node_modules/.pnpm/@tensorflow+tfjs-backend-cpu@4.22.0/tfjs-backend-cpu/src/index.ts"),
    "@tensorflow/tfjs-backend-cpu"
  );
  assert.equal(
    getPackageName("node_modules/.pnpm/tfjs-backend-cpu/src/kernels/Identity.ts"),
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

  // Error handling: unmatched bare package name throws
  assert.throws(
    () => getPackageName("node_modules/.pnpm/unmatched-nonexistent-package/src/index.ts"),
    /Unmatched bare package name in sourcemap/
  );

  // Error handling: ambiguous bare package name throws
  const ambiguousMap = buildScopedPackageMap(["@scope-a/widget", "@scope-b/widget"]);
  assert.throws(
    () => resolveBarePackageName("widget", ambiguousMap),
    /Ambiguous bare package name in sourcemap/
  );
});

test("measureDirectory decodes search.mjs with strict file size reconciliation", (t) => {
  const distDir = path.resolve(import.meta.dirname, "../../dist/skills-cli");
  if (!fs.existsSync(distDir)) {
    t.skip("dist not built");
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
