import * as tf from "@tensorflow/tfjs";
import { AutoTokenizer } from "./dist/tokenizer.js";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

export class TfjsEmbedder {
  private static instance: TfjsEmbedder;
  private model: tf.GraphModel | null = null;
  private tokenizer: any = null;
  private serverProcess: ChildProcess | null = null;
  public modelName = "tfjs:all-MiniLM-L6-v2";
  private port = 8085;

  private constructor() {}

  public static getInstance(): TfjsEmbedder {
    if (!TfjsEmbedder.instance) {
      TfjsEmbedder.instance = new TfjsEmbedder();
    }
    return TfjsEmbedder.instance;
  }

  public async init() {
    if (this.model) return;

    console.log("Starting local HTTP server for model files...");
    const benchmarkDir = path.resolve(import.meta.dirname);
    
    // Start Python HTTP server in the benchmark directory
    this.serverProcess = spawn("python3", ["-m", "http.server", this.port.toString()], {
      cwd: benchmarkDir,
      stdio: "ignore"
    });

    // Wait a bit for the server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    const modelUrl = `http://localhost:${this.port}/tfjs_model_minilm/model.json`;
    console.log(`Loading TFJS model from ${modelUrl}...`);

    try {
        this.model = await tf.loadGraphModel(modelUrl);
        console.log("TFJS Model loaded successfully!");
        
        console.log("Loading tokenizer...");
        this.tokenizer = await AutoTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
    } catch (e) {
        console.error("Failed to load TFJS model:", e);
        this.shutdown();
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
    if (this.serverProcess) {
        console.log("Stopping local HTTP server...");
        this.serverProcess.kill();
        this.serverProcess = null;
    }
  }
}
