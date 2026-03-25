import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Embedder {
  private static instance: Embedder;
  private pipe: FeatureExtractionPipeline | null = null;
  private gpt4allModel: any = null;
  public modelName = "Xenova/all-MiniLM-L6-v2";
  private gpt4allModule: any = null;

  private constructor(modelName?: string) {
    if (modelName) {
      this.modelName = modelName;
    }
  }

  public static getInstance(modelName?: string): Embedder {
    if (!Embedder.instance || (modelName && Embedder.instance.modelName !== modelName)) {
      Embedder.instance = new Embedder(modelName);
    }
    return Embedder.instance;
  }

  private get isGpt4All(): boolean {
    return this.modelName.includes(".gguf") || this.modelName.includes("nomic");
  }

  private async loadGpt4All() {
    if (this.gpt4allModule) return this.gpt4allModule;
    try {
      this.gpt4allModule = await import("gpt4all");
    } catch {
      // Fallback to sandbox-embed installation which holds the valid compiled native bindings
      const sandboxPath = path.resolve(__dirname, "../../sandbox-embed/node_modules/gpt4all/src/gpt4all.js");
      this.gpt4allModule = await import(sandboxPath);
    }
    return this.gpt4allModule;
  }

  public async init() {
    if (this.isGpt4All) {
      if (this.gpt4allModel) return;
      const { loadModel } = await this.loadGpt4All();
      this.gpt4allModel = await loadModel(this.modelName, { type: 'embedding' });
    } else {
      if (this.pipe) return;
      this.pipe = (await pipeline("feature-extraction", this.modelName, { dtype: "q8" })) as any as FeatureExtractionPipeline;
    }
  }

  public async embed(text: string): Promise<number[]> {
    if (this.isGpt4All) {
      if (!this.gpt4allModel) await this.init();
      if (!this.gpt4allModel) throw new Error("Failed to initialize GPT4All model.");

      const { createEmbedding } = await this.loadGpt4All();
      const result = createEmbedding(this.gpt4allModel, text);
      
      let embeddingList: number[] = [];
      if (Array.isArray(result.embeddings)) {
          embeddingList = result.embeddings;
      } else if (result.embeddings instanceof Float32Array) {
          embeddingList = Array.from(result.embeddings);
      } else if (typeof result.embeddings === 'object') {
          const keys = Object.keys(result.embeddings).filter(k => !isNaN(Number(k)));
          embeddingList = keys.map(k => (result.embeddings as any)[k]);
      }
      return embeddingList;
    } else {
      if (!this.pipe) await this.init();
      if (!this.pipe) throw new Error("Failed to initialize embedding pipeline");
      const output = await this.pipe(text, { pooling: "mean", normalize: true });
      return Array.from(output.data);
    }
  }
}
