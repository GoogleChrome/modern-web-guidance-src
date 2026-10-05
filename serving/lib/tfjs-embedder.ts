import { setBackend, tensor2d, type Tensor } from "@tensorflow/tfjs-core";
import { loadGraphModel, type GraphModel } from "@tensorflow/tfjs-converter";
import { Tokenizer } from "@huggingface/tokenizers";
import "./tfjs-kernels.ts";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";

// Custom IOHandler for loading TFJS models from disk in Node without fetch
function createNodeFileSystemIOHandler(modelJsonPath: string) {
  return {
    load: async () => {
      const dir = path.dirname(modelJsonPath);
      const modelJson = JSON.parse(await fs.promises.readFile(modelJsonPath, "utf-8"));
      const modelTopology = modelJson.modelTopology;
      const weightsManifest = modelJson.weightsManifest;
      const weightSpecs: any[] = [];

      // NOTE: Simplified assuming 1 shard for MiniLM (group1-shard1of1.bin).
      // If we go back to multiple shards in the future, restore the loops:
      // for (const manifest of weightsManifest) { weightSpecs.push(...manifest.weights); for (const shardPath of manifest.paths) shardPromises.push(fs.promises.readFile(path.resolve(dir, shardPath))); }
      const manifest = weightsManifest[0];
      weightSpecs.push(...manifest.weights);
      const shardPath = manifest.paths[0];
      const fullPath = path.resolve(dir, shardPath);
      const weightData = (await fs.promises.readFile(fullPath)).buffer;

      return {
        modelTopology,
        weightSpecs,
        weightData
      };
    }
  };
}

export class TfjsEmbedder {
  private static instance: TfjsEmbedder | null = null;
  private model: GraphModel | null = null;
  private tokenizer: Tokenizer | null = null;
  private modelMaxLength = 512;
  private sepTokenId = 102;
  private initPromise: Promise<void> | null = null;
  public modelName = "tfjs:all-MiniLM-L6-v2";

  private constructor() {}

  public static getInstance(): TfjsEmbedder {
    if (!TfjsEmbedder.instance) {
      TfjsEmbedder.instance = new TfjsEmbedder();
    }
    return TfjsEmbedder.instance;
  }

  public static clearInstance(): void {
    if (TfjsEmbedder.instance) {
      TfjsEmbedder.instance.shutdown();
      TfjsEmbedder.instance = null;
    }
  }

  public async init(): Promise<void> {
    if (this.model && this.tokenizer) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const benchmarkDir = path.resolve(import.meta.dirname);
      const modelPath = path.resolve(benchmarkDir, "tfjs_model_minilm/model.json");
      const tokGzPath = path.resolve(benchmarkDir, "tfjs_model_minilm/tokenizer.json.gz");
      const tokCfgPath = path.resolve(benchmarkDir, "tfjs_model_minilm/tokenizer_config.json");

      if (!fs.existsSync(modelPath)) {
        throw new Error(`TFJS model file not found: ${modelPath}`);
      }
      if (!fs.existsSync(tokGzPath)) {
        throw new Error(`Tokenizer file not found: ${tokGzPath}`);
      }
      if (!fs.existsSync(tokCfgPath)) {
        throw new Error(`Tokenizer config not found: ${tokCfgPath}`);
      }

      const ioHandler = createNodeFileSystemIOHandler(modelPath);

      // Silence TFJS console warning about node backend
      const oldLog = console.log;
      const oldWarn = console.warn;
      console.log = () => {};
      console.warn = () => {};

      try {
        await setBackend("cpu");
        this.model = await loadGraphModel(ioHandler as any);
      } finally {
        console.log = oldLog;
        console.warn = oldWarn;
      }

      const tokJsonGz = fs.readFileSync(tokGzPath);
      const tokJson = JSON.parse(zlib.gunzipSync(tokJsonGz).toString("utf8"));
      const tokCfg = JSON.parse(fs.readFileSync(tokCfgPath, "utf8"));
      if (typeof tokCfg.model_max_length !== "number") {
        throw new Error(`Tokenizer config missing valid numeric model_max_length: ${tokCfgPath}`);
      }
      this.modelMaxLength = tokCfg.model_max_length;
      this.tokenizer = new Tokenizer(tokJson, tokCfg);

      if (typeof tokCfg.sep_token !== "string") {
        throw new Error(`Tokenizer config missing sep_token string: ${tokCfgPath}`);
      }
      const sepTokenId = this.tokenizer.token_to_id(tokCfg.sep_token);
      if (typeof sepTokenId !== "number") {
        throw new Error(`Failed to resolve sep_token "${tokCfg.sep_token}" to token ID`);
      }
      this.sepTokenId = sepTokenId;
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  public async embed(text: string): Promise<number[]> {
    if (!this.model || !this.tokenizer) {
      await this.init();
    }
    if (!this.model || !this.tokenizer) {
      throw new Error("Failed to initialize TFJS Embedder");
    }

    const enc = this.tokenizer.encode(text);
    const maxLen = this.modelMaxLength;
    let inputIdsData = enc.ids;
    let attentionMaskData = enc.attention_mask;
    if (inputIdsData.length > maxLen) {
      inputIdsData = [...inputIdsData.slice(0, maxLen - 1), this.sepTokenId];
      attentionMaskData = attentionMaskData.slice(0, maxLen);
    }
    const tokenTypeIdsData = Array.from({ length: inputIdsData.length }, () => 0);

    const inputIds = tensor2d([inputIdsData], undefined, "int32");
    const attentionMask = tensor2d([attentionMaskData], undefined, "int32");
    const tokenTypeIds = tensor2d([tokenTypeIdsData], undefined, "int32");
    let result: Tensor | null = null;

    try {
      result = this.model.predict({
        input_ids: inputIds,
        attention_mask: attentionMask,
        token_type_ids: tokenTypeIds
      }) as Tensor;

      const data = await result.data();
      return Array.from(data);
    } finally {
      inputIds.dispose();
      attentionMask.dispose();
      tokenTypeIds.dispose();
      if (result) {
        result.dispose();
      }
    }
  }

  public shutdown(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.tokenizer = null;
    this.initPromise = null;
  }
}
