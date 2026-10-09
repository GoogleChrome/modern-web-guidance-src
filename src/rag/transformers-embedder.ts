import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export class Embedder {
  private static instance: Embedder | null = null;
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

  public static clearInstance(): void {
    Embedder.instance = null;
  }

  public async init(): Promise<void> {
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

  public async embed(text: string, _isQuery = false): Promise<number[]> {
    if (!this.pipe) await this.init();
    if (!this.pipe) throw new Error("Failed to initialize embedding pipeline");
    const output = await this.pipe(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }

  public async countTokens(text: string): Promise<number> {
    if (!this.pipe) await this.init();
    const tokenizer = (this.pipe as any)?.tokenizer;
    if (!tokenizer) {
      throw new Error("Embedding pipeline has no tokenizer available for countTokens");
    }
    const res = await tokenizer(text, { add_special_tokens: false });
    const count = res?.input_ids?.data?.length;
    if (typeof count !== "number") {
      throw new Error(`Tokenizer returned invalid token count for text: ${typeof count}`);
    }
    return count;
  }
}
