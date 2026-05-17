import { setBackend, ready } from "@tensorflow/tfjs-core";
import { loadGraphModel, GraphModel } from "@tensorflow/tfjs-converter";
import { BertTokenizer } from "@huggingface/transformers";
import "./tfjs-kernels.ts";

import { embedTextCore } from "./tfjs-embedder.ts";
import { searchVectorsCore, calculateNorm, VectorItem, UseCaseResult } from "./search.ts";

export { UseCaseResult };

export type ClientStatus =
  | 'idle'
  | 'initializing'
  | 'loading-model'
  | 'loading-vectors'
  | 'ready'
  | 'error';

export type ProgressStep = 'model' | 'tokenizer' | 'vectors' | 'warmup';

export interface GuidanceProgressEventInit extends EventInit {
  step: ProgressStep;
  loadedBytes: number;
  totalBytes: number | null;
  percentage: number;
}

export class GuidanceProgressEvent extends Event {
  readonly step: ProgressStep;
  readonly loadedBytes: number;
  readonly totalBytes: number | null;
  readonly percentage: number;

  constructor(type: string, eventInitDict: GuidanceProgressEventInit) {
    super(type, eventInitDict);
    this.step = eventInitDict.step;
    this.loadedBytes = eventInitDict.loadedBytes;
    this.totalBytes = eventInitDict.totalBytes;
    this.percentage = eventInitDict.percentage;
  }
}

export interface GuidanceStatusChangeEventInit extends EventInit {
  status: ClientStatus;
  error?: Error;
}

export class GuidanceStatusChangeEvent extends Event {
  readonly status: ClientStatus;
  readonly error?: Error;

  constructor(type: string, eventInitDict: GuidanceStatusChangeEventInit) {
    super(type, eventInitDict);
    this.status = eventInitDict.status;
    this.error = eventInitDict.error;
  }
}

export interface ClientConfig {
  /** Helper to resolve default asset paths relative to this URL */
  baseURL?: string;
  /** Direct override for the TFJS model.json URL. */
  modelURL?: string;
  /** Direct override for the vectors file URL. */
  vectorsURL?: string;
  /** Direct override for the directory containing markdown guides. */
  guidesBaseURL?: string;
  /** Custom fetch wrapper to route calls */
  fetch?: typeof fetch;
  /** TensorFlow.js backend: 'cpu' | 'webgl' | 'webgpu'. Defaults to 'cpu' in prototype due to CPU kernels constraint. */
  backend?: 'cpu' | 'webgl' | 'webgpu';
  /** Enable storing the TFJS model in IndexedDB. Defaults to true. */
  cacheModel?: boolean;
  /** Enable storing the vectors in the Cache API. Defaults to true. */
  cacheVectors?: boolean;
}

export interface GuidanceBrowserClientEventMap {
  'statuschange': GuidanceStatusChangeEvent;
  'progress': GuidanceProgressEvent;
}

export class GuidanceBrowserClient extends EventTarget {
  private config: Required<Omit<ClientConfig, 'baseURL'>>;
  private status: ClientStatus = 'idle';
  private model: GraphModel | null = null;
  private tokenizer: any | null = null;
  private cachedVectors: VectorItem[] | null = null;
  private initPromise: Promise<void> | null = null;
  private lastError: Error | null = null;

  // Standard Event Handler Properties
  onstatuschange: ((this: GuidanceBrowserClient, ev: GuidanceStatusChangeEvent) => any) | null = null;
  onprogress: ((this: GuidanceBrowserClient, ev: GuidanceProgressEvent) => any) | null = null;

  constructor(config: ClientConfig = {}) {
    super();
    const baseURL = config.baseURL ?? '.';
    this.config = {
      modelURL: config.modelURL ?? `${baseURL}/tfjs_model_minilm/model.json`,
      vectorsURL: config.vectorsURL ?? `${baseURL}/use-cases.vectors.gen.json.gz`,
      guidesBaseURL: config.guidesBaseURL ?? `${baseURL}/guides`,
      fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
      backend: config.backend ?? 'cpu', // Default to CPU for now as our custom kernels are CPU-based
      cacheModel: config.cacheModel ?? true,
      cacheVectors: config.cacheVectors ?? true
    };
  }

  private setStatus(newStatus: ClientStatus, error?: Error) {
    this.status = newStatus;
    if (error) this.lastError = error;
    
    const event = new GuidanceStatusChangeEvent('statuschange', { status: newStatus, error });
    this.dispatchEvent(event);
    if (this.onstatuschange) {
      this.onstatuschange(event);
    }
  }

  private dispatchProgress(step: ProgressStep, loadedBytes: number, totalBytes: number | null) {
    const percentage = totalBytes ? Math.round((loadedBytes / totalBytes) * 100) : 0;
    const event = new GuidanceProgressEvent('progress', {
      step,
      loadedBytes,
      totalBytes,
      percentage
    });
    this.dispatchEvent(event);
    if (this.onprogress) {
      this.onprogress(event);
    }
  }

  public getStatus(): ClientStatus {
    return this.status;
  }

  /**
   * Initializes both the Embedder and the Vector Store.
   * Can be pre-called to warm up resources.
   */
  public async bootstrap(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.setStatus('initializing');
      try {
        // Setup TFJS backend
        await ready();
        await setBackend(this.config.backend);

        // Load model and vectors in parallel
        await Promise.all([
          this.loadModel(),
          this.loadVectors()
        ]);

        // Warm up the model
        this.dispatchProgress('warmup', 0, 100);
        await embedTextCore("warmup", this.model!, this.tokenizer!);
        this.dispatchProgress('warmup', 100, 100);

        this.setStatus('ready');
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.setStatus('error', error);
        this.initPromise = null; // Allow retry on failure
        throw error;
      }
    })();

    return this.initPromise;
  }

  public async loadModel(): Promise<void> {
    if (this.model && this.tokenizer) return;

    this.setStatus('loading-model');
    const INDEXEDDB_PATH = `indexeddb://model-${this.config.modelURL.replace(/[^a-zA-Z0-9]/g, '-')}`;

    // 1. Try loading model from IndexedDB
    if (this.config.cacheModel) {
      try {
        // loadGraphModel expects standard TFJS environment, which in browser supports indexeddb://
        this.model = await loadGraphModel(INDEXEDDB_PATH);
        console.log("Loaded TFJS model from IndexedDB Cache");
        this.dispatchProgress('model', 22500000, 22500000); // Mark as done
      } catch (e) {
        console.log("Model not found in IndexedDB, loading from network...");
      }
    }

    // 2. Load model from network if not cached
    if (!this.model) {
      this.model = await loadGraphModel(this.config.modelURL, {
        onProgress: (fraction) => {
          const total = 22500000; // Est size of MiniLM model
          this.dispatchProgress('model', Math.round(fraction * total), total);
        },
        fetchFunc: this.config.fetch // Use custom fetch if provided
      });

      // Save to IndexedDB for next time
      if (this.config.cacheModel) {
        try {
          await this.model.save(INDEXEDDB_PATH);
          console.log("Saved TFJS model to IndexedDB Cache");
        } catch (e) {
          console.warn("Failed to cache model to IndexedDB:", e);
        }
      }
    }

    // 3. Load Tokenizer (Transformers.js handles its own Cache API storage)
    this.dispatchProgress('tokenizer', 0, 100);
    this.tokenizer = await BertTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
    this.dispatchProgress('tokenizer', 100, 100);
  }

  public async loadVectors(): Promise<void> {
    if (this.cachedVectors) return;

    this.setStatus('loading-vectors');
    let response: Response;
    const cacheName = 'guidance-vectors-cache';
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(this.config.vectorsURL);

    // 1. Try loading vectors from Cache API
    if (cachedResponse && this.config.cacheVectors) {
      console.log("Loaded vectors from Cache API");
      response = cachedResponse;
    } else {
      // 2. Fetch from network
      response = await this.config.fetch(this.config.vectorsURL);
      if (!response.ok) {
        throw new Error(`Failed to fetch vectors: ${response.statusText}`);
      }

      // Save clone to Cache API
      if (this.config.cacheVectors) {
        await cache.put(this.config.vectorsURL, response.clone());
      }
    }

    // 3. Track download/read progress
    const totalBytesHeader = response.headers.get("content-length");
    const totalBytes = totalBytesHeader ? parseInt(totalBytesHeader, 10) : null;
    let loadedBytes = 0;

    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loadedBytes += value.length;

      this.dispatchProgress('vectors', loadedBytes, totalBytes);
    }

    // 4. Concatenate and decompress
    const blob = new Blob(chunks);
    const ds = new DecompressionStream("gzip");
    const decompressedStream = blob.stream().pipeThrough(ds);
    const decompressedResponse = new Response(decompressedStream);
    const jsonContent = await decompressedResponse.text();
    const items: any[] = JSON.parse(jsonContent);

    this.cachedVectors = items.map(item => ({
      id: item.id,
      description: item.description,
      category: item.category,
      featuresUsed: item.featuresUsed || [],
      tokenCount: item.tokenCount || 0,
      vector: item.vector,
      norm: item.vector ? calculateNorm(item.vector) : 0
    })).filter(item => item.vector);
  }

  /**
   * Performs semantic search. Auto-bootstraps if not already initialized.
   * 
   * TODO: Consider adding AbortSignal support for cancellation.
   */
  public async search(query: string, options?: { limit?: number; minSimilarity?: number }): Promise<UseCaseResult[]> {
    if (this.status !== 'ready') {
      await this.bootstrap();
    }

    const limit = options?.limit ?? 5;
    const minSimilarity = options?.minSimilarity ?? 0.3;

    const queryVector = await embedTextCore(query, this.model!, this.tokenizer!);
    return searchVectorsCore(queryVector, this.cachedVectors!, limit, minSimilarity);
  }

  /**
   * Fetches the raw markdown guide contents.
   */
  public async retrieve(target: { id: string; category: string }): Promise<string> {
    const url = `${this.config.guidesBaseURL}/${target.category}/${target.id}.md`;
    const response = await this.config.fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to retrieve guide ${target.id} from ${url}: ${response.statusText}`);
    }
    return response.text();
  }

  /**
   * Synchronously dispose tensors and clear references.
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.tokenizer = null;
    this.cachedVectors = null;
    this.initPromise = null;
    this.setStatus('idle');
    console.log("GuidanceBrowserClient resources disposed");
  }

  // Strong types support for EventTarget
  addEventListener<K extends keyof GuidanceBrowserClientEventMap>(
    type: K,
    listener: (this: GuidanceBrowserClient, ev: GuidanceBrowserClientEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof GuidanceBrowserClientEventMap>(
    type: K,
    listener: (this: GuidanceBrowserClient, ev: GuidanceBrowserClientEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type, listener, options);
  }
}
