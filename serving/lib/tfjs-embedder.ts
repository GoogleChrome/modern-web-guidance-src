import { io, enableProdMode, setBackend, tensor2d, type Tensor } from "@tensorflow/tfjs-core";
import { loadGraphModel, type GraphModel } from "@tensorflow/tfjs-converter";
import { Tokenizer } from "@huggingface/tokenizers";
import "./tfjs-kernels.ts";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";

interface LoadedArtifacts {
  model: GraphModel;
  tokenizer: Tokenizer;
  maxLen: number;
  sepId: number;
}

async function load(): Promise<LoadedArtifacts> {
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
    weightData,
  });
  const model = await loadGraphModel(ioHandler);

  const tokJsonGz = fs.readFileSync(tokGzPath);
  const tokJson = JSON.parse(zlib.gunzipSync(tokJsonGz).toString("utf8"));
  const tokCfg = JSON.parse(fs.readFileSync(tokCfgPath, "utf8"));
  if (typeof tokCfg.model_max_length !== "number") {
    throw new Error(`Tokenizer config missing valid numeric model_max_length: ${tokCfgPath}`);
  }
  const maxLen = tokCfg.model_max_length;
  const tokenizer = new Tokenizer(tokJson, tokCfg);

  if (typeof tokCfg.sep_token !== "string") {
    throw new Error(`Tokenizer config missing sep_token string: ${tokCfgPath}`);
  }
  const sepId = tokenizer.token_to_id(tokCfg.sep_token);
  if (typeof sepId !== "number") {
    throw new Error(`Failed to resolve sep_token "${tokCfg.sep_token}" to token ID`);
  }

  return { model, tokenizer, maxLen, sepId };
}

export class TfjsEmbedder {
  private static instance: TfjsEmbedder | null = null;
  private loaded: Promise<LoadedArtifacts> | null = null;

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

  public init(): Promise<LoadedArtifacts> {
    return (this.loaded ??= load().catch((e) => {
      this.loaded = null;
      throw e;
    }));
  }

  public async embed(text: string): Promise<number[]> {
    const { model, tokenizer, maxLen, sepId } = await this.init();

    const enc = tokenizer.encode(text);
    let inputIdsData = enc.ids;
    let attentionMaskData = enc.attention_mask;
    if (inputIdsData.length > maxLen) {
      inputIdsData = [...inputIdsData.slice(0, maxLen - 1), sepId];
      attentionMaskData = attentionMaskData.slice(0, maxLen);
    }
    const tokenTypeIdsData = Array.from({ length: inputIdsData.length }, () => 0);

    const inputIds = tensor2d([inputIdsData], undefined, "int32");
    const attentionMask = tensor2d([attentionMaskData], undefined, "int32");
    const tokenTypeIds = tensor2d([tokenTypeIdsData], undefined, "int32");
    let result: Tensor | null = null;

    try {
      result = model.predict({
        input_ids: inputIds,
        attention_mask: attentionMask,
        token_type_ids: tokenTypeIds,
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
    if (this.loaded) {
      this.loaded.then(({ model }) => model.dispose()).catch(() => {});
      this.loaded = null;
    }
  }
}
