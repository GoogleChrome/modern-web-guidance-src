import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";
import * as ort from "onnxruntime-web";
import path from "path";

// Force the WebAssembly runtime instead of native node binaries for lightweight CLI dist
globalThis[Symbol.for("onnxruntime")] = ort;

// Configure Transformers environment for local WASM execution
env.backends.onnx.wasm.numThreads = 1;
// The dist pipeline will copy WASM files to a sibling 'wasm' folder
env.backends.onnx.wasm.wasmPaths = path.join(import.meta.dirname, "../wasm/");

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

  public async embed(text: string, isQuery = false): Promise<number[]> {
    if (!this.pipe) await this.init();
    if (!this.pipe) throw new Error("Failed to initialize embedding pipeline");

    let input = text;
    const isGemma = this.modelName.toLowerCase().includes("gemma");

    if (isGemma) {
        // Instruction-tuned architecture requirements explicitly define specialized task formatting prefixes
        if (isQuery) {
            input = `task: search result | query: ${text}`;
        } else {
            input = `title: none | text: ${text}`;
        }
    }

    const output = await this.pipe(input, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }
}
