import { setBackend, tensor2d, Tensor } from "@tensorflow/tfjs-core";
import { loadGraphModel, GraphModel } from "@tensorflow/tfjs-converter";
import { BertTokenizer } from "@huggingface/transformers";
import "./tfjs-kernels.ts";
import path from "path";
import fs from "fs";

// Custom IOHandler for loading TFJS models from disk in Node without fetch
function createNodeFileSystemIOHandler(modelJsonPath: string) {
  return {
    load: async () => {
      const dir = path.dirname(modelJsonPath);
      const modelJson = JSON.parse(await fs.promises.readFile(modelJsonPath, "utf-8"));

      const modelTopology = modelJson.modelTopology;
      const weightsManifest = modelJson.weightsManifest;

      const weightSpecs: any[] = [];
      const shardPromises: Promise<Buffer>[] = [];

      for (const manifest of weightsManifest) {
        weightSpecs.push(...manifest.weights);
        for (const shardPath of manifest.paths) {
          const fullPath = path.resolve(dir, shardPath);
          shardPromises.push(fs.promises.readFile(fullPath));
        }
      }

      const buffers = await Promise.all(shardPromises);
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
  private model: GraphModel | null = null;
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

    try {
        const ioHandler = createNodeFileSystemIOHandler(modelPath);

        // Silence TFJS console warning about node backend
        const oldLog = console.log;
        const oldWarn = console.warn;
        console.log = () => {};
        console.warn = () => {};

        await setBackend('cpu');
        this.model = await loadGraphModel(ioHandler as any);

        console.log = oldLog;
        console.warn = oldWarn;

        try {
            this.tokenizer = await BertTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2", { local_files_only: true });
        } catch (e) {
            this.tokenizer = await BertTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
        }
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

    const inputIds = tensor2d([inputIdsData], undefined, 'int32');
    const attentionMask = tensor2d([attentionMaskData], undefined, 'int32');
    const tokenTypeIds = tensor2d([tokenTypeIdsData], undefined, 'int32');

    const result = this.model.predict({
        "input_ids": inputIds,
        "attention_mask": attentionMask,
        "token_type_ids": tokenTypeIds
    }) as Tensor;

    const data = await result.data();

    // Cleanup tensors
    inputIds.dispose();
    attentionMask.dispose();
    tokenTypeIds.dispose();
    result.dispose();

    return Array.from(data);
  }

  public shutdown() {
    // No-op: we use custom IO handler instead of local server now
  }
}
