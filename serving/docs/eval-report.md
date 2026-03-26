# Choosing our Local Embedding Model

My coding agent and I recently wrapped up a set of offline evaluation loops to figure out which local embedding model gives us the absolute best retrieval accuracy for our `modern-web` skills CLI. 

Our main goal was to find a model that maximizes how often we fetch the exact right context without bloating up our `node_modules` distribution size.

## TL;DR
We're officially sticking with **`Xenova/all-MiniLM-L6-v2`** running natively through the `@huggingface/transformers` Node library (which uses ONNX under the hood). Even when compared to modern foundation models pushing 300 million parameters, this tiny 23 MB model specifically designed for sentence similarity still consistently beats everything else on pure accuracy and memory utilization. Gotta love it. :)

---

## How We Tested
We didn't want to eyeball it, so we built an automated evaluation pipeline. My coding agent generated 850 synthetic, real-world query prompts using the Gemini API. We then statistically sampled those queries, built the temporary vector databases, and measured two key things:

* **Top-1 Hit Rate:** Did the exact right markdown guide show up as the literal #1 search result?
* **MRR (Mean Reciprocal Rank):** On average, how high up the list did the right answer consistently cluster? 

## The Benchmark Results

Here's how the average accuracy stacked up across our pipeline. 

![MiniLM (ONNX) vs Nomic Text (GPT4All)](./assets/minilm-vs-nomic.png)

We systematically evaluated a few major architectural variants: 
- The tried-and-true `MiniLM` (~23M parameters)
- Nomic's customized text embedder (`nomic-embed-text-v1.5`, ~137M parameters)
- Google's brand new `EmbeddingGemma` (~300M parameters)

![All 4 MiniLM Quants vs 4 Nomic Quants](./assets/all-quants.png)

Across all variations of model compressions (quantizations), MiniLM just refuses to lose. It averaged a solid **71.8%** Top-1 hit rate, whereas newer generalized models like Nomic and Gemma hovered down around 60%. 

Why did this happen? MiniLM was explicitly fine-tuned for dense-query clustering, whereas newer models like Gemma are often stronger at zero-shot generalization across large swaths of text. Basically, for strict semantic document-lookup tasks, MiniLM’s specialty still noticeably shines here.

---

## Engineering Trade-Offs & Discoveries

We dug into a few different execution layers, trying to see if we could get more speed or better distribution packaging by swapping from our native Javascript (ONNX) pipeline over to a C++ backed runtime (GPT4All/llama.cpp). 

We bumped into a few fascinating takeaways:

First, integrating GPT4All meant directly compiling specific native bindings for macOS ARM processors via `node-gyp`. When pushing updates to cross-collaboration toolchains, fetching native binaries dynamically caused critical execution pathing breaks immediately compared to the strictly isomorphic JavaScript capability of ONNX/Transformers.js.

We also noticed a surprisingly consistent precision penalty. When we evaluated a 1-to-1 comparison running MiniLM in the `.ONNX` format versus the `.GGUF` format specifically on the exact same `fp16` model weights, the C++ execution dropped almost 9 whole points in accuracy. 
- **ONNX Engine Average:** 73.2% Top-1 hit rate. 
- **GPT4All Engine Average:** 64.4% Top-1 hit rate.

![MiniLM fp16 (ONNX) vs MiniLM fp16 (GPT4All)](./assets/minilm-onnx-vs-gpt4all.png)

We honestly aren't completely sure why this exact precision loss occurs inside the C++ execution engine. Our best guess is that compiling the model down to the `.gguf` architecture internally scrambles some of the explicit spatial logic natively baked into the original vectors. Regardless, the ONNX WASM pipeline algorithmically preserves the model's accuracy much better. 

Finally, testing Google's newer Gemma-300m foundation logic directly required locating an ONNX runtime translation built by the open-source community, since official C++ and local parsing support is still maturing. While the Gemma port ran beautifully, it proved to be a 300MB bundle payload size that ultimately performed worse in vector-space accuracy than our 23MB choice anyway!

![MiniLM vs EmbeddingGemma](./assets/minilm-vs-gemma.png)

## Chunking: A Lesson in Sample Sizes

It's standard practice in the RAG space to parse long files into multiple little chunks (usually by splitting at markdown headers). Since the start, the guidance server has mirrored this—splitting our 17 skill guides into 140 separate vectors.

We originally ran an experiment disabling chunking completely—throwing the entire file body natively into a single vector. On our initial test pool of **85 static queries**, our hit rate jumped an entire 11 points—from **80.0%** up to **91.8%**. We thought we had a massive breakthrough.

However, when we procedurally scaled our test pool up to **850 complex queries** to rigorously validate the system against edge cases, the entire metric inverted. The 850-query dataset dragged overall accuracy baselines down to the 70s, but more importantly, **Chunking actually beat No-Chunking by 2-3% on average** (~74.1% vs ~71.8%). 

When queries get significantly harder, fuzzier, and loaded with weirder edge cases, chunking's ability to localize semantic density structurally outperforms a massive, diluted full-document vector. We'll be keeping chunks explicitly enabled in the guidance server!

## Next Steps

1. **Stripping out JS in favor of Pure WASM:** While we've verified that the ONNX backend mathematically beats the C++ backend for accuracy, the `@huggingface/transformers` npm package still pulls down a reasonably heavy javascript wrapper. My coding agent and I will investigate transitioning directly to the underlying `transformers-wasm` engine to dramatically shrink the CLI's installation footprint with zero loss in accuracy.
2. **PCA Dimensionality Reduction:** We'll be exploring Principal Component Analysis (PCA) to compress the static 384-dimension semantic vectors outputted by MiniLM. If we can confidently flatten dimensions before executing cosine similarity math over LanceDB, we could exponentially decrease latency and memory lookup overhead while retrieving.
