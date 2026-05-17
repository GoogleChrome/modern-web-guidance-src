import { setBackend, tensor2d, Tensor } from "@tensorflow/tfjs-core";
import { loadGraphModel, GraphModel } from "@tensorflow/tfjs-converter";
import { BertTokenizer } from "@huggingface/transformers";
import "./tfjs-kernels.ts";

export class TfjsEmbedderBrowser {
  private static instance: TfjsEmbedderBrowser;
  private model: GraphModel | null = null;
  private tokenizer: any = null;
  public modelName = "tfjs:all-MiniLM-L6-v2";

  private constructor() {}

  public static getInstance(): TfjsEmbedderBrowser {
    if (!TfjsEmbedderBrowser.instance) {
      TfjsEmbedderBrowser.instance = new TfjsEmbedderBrowser();
    }
    return TfjsEmbedderBrowser.instance;
  }

  public static clearInstance() {
    TfjsEmbedderBrowser.instance = null as any;
  }

  /**
   * Initialize the embedder.
   * @param modelUrl URL to the model.json file.
   */
  public async init(modelUrl: string) {
    if (this.model) return;

    try {
        // In browser, we use the default backend (usually webgl or webgpu if available, falling back to cpu/wasm)
        // For prototype, we can try to set it to 'cpu' or just let it use whatever is default/available.
        // Actually, we might need to register kernels. tfjs-kernels-precise.ts registers CPU kernels.
        // If we want to use WebGL, we would need to import webgl backend and register its kernels.
        // Since we are importing `./tfjs-kernels.ts` (which build-dist aliases to tfjs-kernels-precise.ts, which is CPU-only),
        // we should probably stick to CPU for simplicity of the prototype, or ensure CPU backend is set.
        await setBackend('cpu');

        this.model = await loadGraphModel(modelUrl);

        // Fetch tokenizer from Hugging Face CDN (default behavior in browser)
        this.tokenizer = await BertTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
    } catch (e) {
        console.error("Failed to load TFJS model in browser:", e);
        throw e;
    }
  }

  public async embed(text: string, modelUrl?: string): Promise<number[]> {
    if (!this.model || !this.tokenizer) {
        if (!modelUrl) {
            throw new Error("Model URL required for initialization");
        }
        await this.init(modelUrl);
    }
    if (!this.model || !this.tokenizer) {
        throw new Error("Failed to initialize TFJS Embedder");
    }

    const tokenized = await this.tokenizer(text, { padding: true, truncation: true });

    // Extract data and convert to numbers
    const extractData = (tensor: any) => {
        const data = tensor.data || tensor;
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
}
