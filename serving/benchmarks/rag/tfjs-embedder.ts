import * as tf from "@tensorflow/tfjs";
import { AutoTokenizer } from "./dist/tokenizer.js";
import path from "path";
import fs from "fs";

// Custom IOHandler for loading TFJS models from disk in Node without fetch
function createNodeFileSystemIOHandler(modelJsonPath: string) {
  return {
    load: async () => {
      const dir = path.dirname(modelJsonPath);
      const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, "utf-8"));
      
      const modelTopology = modelJson.modelTopology;
      const weightsManifest = modelJson.weightsManifest;
      
      const buffers: Buffer[] = [];
      const weightSpecs: any[] = [];
      
      for (const manifest of weightsManifest) {
        weightSpecs.push(...manifest.weights);
        for (const shardPath of manifest.paths) {
          const fullPath = path.resolve(dir, shardPath);
          buffers.push(fs.readFileSync(fullPath));
        }
      }
      
      const weightData = Buffer.concat(buffers).buffer;
      
      return {
        modelTopology,
        weightSpecs,
        weightData
      };
    }
  };
}

export class TfjsEmbedder {
  private static instance: TfjsEmbedder;
  private model: tf.GraphModel | null = null;
  private tokenizer: any = null;
  public modelName = "tfjs:all-MiniLM-L6-v2";

  private constructor() {}

  public static getInstance(): TfjsEmbedder {
    if (!TfjsEmbedder.instance) {
      TfjsEmbedder.instance = new TfjsEmbedder();
    }
    return TfjsEmbedder.instance;
  }

  public static clearInstance() {
    TfjsEmbedder.instance = null as any;
  }

  public async init() {
    if (this.model) return;

    const benchmarkDir = path.resolve(import.meta.dirname);
    const modelPath = path.resolve(benchmarkDir, "tfjs_model_minilm/model.json");
    console.log(`Loading TFJS model from disk: ${modelPath}`);

    try {
        const ioHandler = createNodeFileSystemIOHandler(modelPath);
        this.model = await tf.loadGraphModel(ioHandler as any);
        console.log("TFJS Model loaded successfully!");
        
        console.log("Loading tokenizer...");
        this.tokenizer = await AutoTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
    } catch (e) {
        console.error("Failed to load TFJS model:", e);
        throw e;
    }
  }

  public async embed(text: string, isQuery = false): Promise<number[]> {
    if (!this.model || !this.tokenizer) {
        await this.init();
    }
    if (!this.model || !this.tokenizer) {
        throw new Error("Failed to initialize TFJS Embedder");
    }

    const tokenized = await this.tokenizer(text, { padding: true, truncation: true });
    
    // Extract data and convert to numbers (handling BigInt if present)
    const extractData = (tensor: any) => {
        const data = tensor.data || tensor.ort_tensor?.cpuData || tensor;
        return Array.from(data).map((x: any) => Number(x));
    };
    
    const inputIdsData = extractData(tokenized.input_ids);
    const attentionMaskData = extractData(tokenized.attention_mask);
    const tokenTypeIdsData = extractData(tokenized.token_type_ids);
    
    const inputIds = tf.tensor2d([inputIdsData], undefined, 'int32');
    const attentionMask = tf.tensor2d([attentionMaskData], undefined, 'int32');
    const tokenTypeIds = tf.tensor2d([tokenTypeIdsData], undefined, 'int32');
    
    const result = this.model.predict({
        "input_ids": inputIds,
        "attention_mask": attentionMask,
        "token_type_ids": tokenTypeIds
    }) as tf.Tensor;
    
    const data = await result.data();
    
    // Cleanup tensors
    inputIds.dispose();
    attentionMask.dispose();
    tokenTypeIds.dispose();
    result.dispose();
    
    return Array.from(data);
  }

  public shutdown() {
    if (TfjsEmbedder.serverProcess) {
        console.log("Stopping local HTTP server...");
        TfjsEmbedder.serverProcess.kill();
        TfjsEmbedder.serverProcess = null;
    }
  }
}
