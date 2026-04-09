import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Gpt4AllEmbedder {
  private static instance: Gpt4AllEmbedder;
  private gpt4allModel: any = null;
  public modelName: string;
  private gpt4allModule: any = null;

  private constructor(modelName: string) {
    this.modelName = modelName;
  }

  public static getInstance(modelName: string): Gpt4AllEmbedder {
    if (!Gpt4AllEmbedder.instance || Gpt4AllEmbedder.instance.modelName !== modelName) {
      Gpt4AllEmbedder.instance = new Gpt4AllEmbedder(modelName);
    }
    return Gpt4AllEmbedder.instance;
  }

  private async loadGpt4All() {
    if (this.gpt4allModule) return this.gpt4allModule;
    // We strictly use the generic npm package since sandbox is bypassed in benchmarks
    this.gpt4allModule = await import("gpt4all");
    return this.gpt4allModule;
  }

  public async init() {
    if (this.gpt4allModel) return;
    const { loadModel } = await this.loadGpt4All();
    // Resolving model dynamically from user CLI flags (e.g., nomic-embed-text-v1.5.f32.gguf)
    this.gpt4allModel = await loadModel(this.modelName, { type: 'embedding' });
  }

  public async embed(text: string): Promise<number[]> {
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
        const keys = Object.keys(result.embeddings).filter((k: string) => !isNaN(Number(k)));
        embeddingList = keys.map((k: string) => (result.embeddings as any)[k]);
    }
    return embeddingList;
  }
}
