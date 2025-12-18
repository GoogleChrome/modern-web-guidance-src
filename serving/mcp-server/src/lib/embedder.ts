import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export class Embedder {
  private static instance: Embedder;
  private pipe: FeatureExtractionPipeline | null = null;
  private modelName = "Xenova/all-MiniLM-L6-v2";

  private constructor() { }

  public static getInstance(): Embedder {
    if (!Embedder.instance) {
      Embedder.instance = new Embedder();
    }
    return Embedder.instance;
  }

  public async init() {
    if (this.pipe) return;
    this.pipe = (await pipeline("feature-extraction", this.modelName)) as any as FeatureExtractionPipeline;
  }

  public async embed(text: string): Promise<number[]> {
    if (!this.pipe) {
      await this.init();
    }

    if (!this.pipe) {
      throw new Error("Failed to initialize embedding pipeline");
    }

    // Mean pooling
    const output = await this.pipe(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }
}
