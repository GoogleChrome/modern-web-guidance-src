import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getPackageName,
  decodeMetafileBreakdown,
  measureDirectory,
} from "./bundle-size.ts";

test("decodeMetafileBreakdown aggregates inputs by package", () => {
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
  const packages = decodeMetafileBreakdown(metafile);
  assert.equal(packages["marked"], 40);
  assert.equal(packages["serving/lib"], 50);
});

test("getPackageName correctly extracts package identities", () => {
  assert.equal(getPackageName("serving/lib/search.ts"), "serving/lib");
  assert.equal(getPackageName("constants.ts"), "serving/lib");
  assert.equal(getPackageName("node_modules/marked/lib/marked.esm.js"), "marked");
  assert.equal(getPackageName("node_modules/@tensorflow/tfjs-core/dist/index.js"), "@tensorflow/tfjs-core");

  // pnpm nested node_modules paths
  assert.equal(
    getPackageName("node_modules/.pnpm/@tensorflow+tfjs-core@4.22.0/node_modules/@tensorflow/tfjs-core/dist/index.js"),
    "@tensorflow/tfjs-core"
  );
  assert.equal(
    getPackageName("node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/src/tokenizers.js"),
    "@huggingface/transformers"
  );
  assert.equal(
    getPackageName("node_modules/.pnpm/marked@15.0.0/node_modules/marked/lib/marked.esm.js"),
    "marked"
  );
});

test("measureDirectory decodes search.mjs breakdown", (t) => {
  const distDir = path.resolve(import.meta.dirname, "../../dist/skills-cli");
  if (!fs.existsSync(distDir)) {
    t.skip("dist not built");
    return;
  }
  const snapshot = measureDirectory(distDir);
  assert.ok(snapshot.searchBundle.rawBytes > 0);
  assert.ok(snapshot.searchBundle.gzipBytes > 0);
  assert.ok(snapshot.searchBundle.packages["@tensorflow/tfjs-core"] > 0);
});
