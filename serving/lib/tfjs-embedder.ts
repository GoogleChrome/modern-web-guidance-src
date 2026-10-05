import { io, enableProdMode, setBackend, tensor2d, type Tensor } from "@tensorflow/tfjs-core";
import { loadGraphModel, type GraphModel } from "@tensorflow/tfjs-converter";
import { Tokenizer } from "@huggingface/tokenizers";
import "./tfjs-kernels.ts";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";

export class TfjsEmbedder {
  private static instance: TfjsEmbedder | null = null;
  private model: GraphModel | null = null;
  private tokenizer: Tokenizer | null = null;
  private modelMaxLength = 512;
  private sepTokenId = 102;
  private initPromise: Promise<void> | null = null;

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
      const modelDir = path.resolve(import.meta.dirname, "tfjs_model_minilm");
      const modelJsonPath = path.resolve(modelDir, "model.json");
      const tokGzPath = path.resolve(modelDir, "tokenizer.json.gz");
      const tokCfgPath = path.resolve(modelDir, "tokenizer_config.json");

      enableProdMode();
      await setBackend("cpu");

      const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, "utf8"));
      const weightSpecs = [];
      const shardBuffers: Buffer[] = [];
      for (const manifest of modelJson.weightsManifest) {
        weightSpecs.push(...manifest.weights);
        for (const shardPath of manifest.paths) {
          shardBuffers.push(fs.readFileSync(path.resolve(modelDir, shardPath)));
        }
      }
      const combined = Buffer.concat(shardBuffers);
      const weightData = combined.buffer.slice(
        combined.byteOffset,
        combined.byteOffset + combined.byteLength
      );

      const ioHandler = io.fromMemory({
        modelTopology: modelJson.modelTopology,
        weightSpecs,
        weightData
      });
      this.model = await loadGraphModel(ioHandler);

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
