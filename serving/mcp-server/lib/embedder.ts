import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export class Embedder {
  private static instance: Embedder;
  private pipe: FeatureExtractionPipeline | null = null;
  public modelName = "Xenova/all-MiniLM-L6-v2";

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

  public async init() {
    if (this.pipe) return;
    
    let repo = this.modelName;
    let dtype = "q8";
    
    if (this.modelName.includes("@")) {
        const parts = this.modelName.split("@");
        repo = parts[0];
        dtype = parts[1];
    }
    
    this.pipe = (await pipeline("feature-extraction", repo, { dtype: dtype as any })) as any as FeatureExtractionPipeline;
  }

  public async embed(text: string): Promise<number[]> {
    if (!this.pipe) await this.init();
    if (!this.pipe) throw new Error("Failed to initialize embedding pipeline");
    const output = await this.pipe(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }
}
