# TensorFlow.js all-MiniLM-L6-v2 Model

This directory contains the `all-MiniLM-L6-v2` model converted to TensorFlow.js Graph Model format.

## Model Details
- **Source Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Format**: TensorFlow.js Graph Model, single shard (`group1-shard1of1.bin`, ~22.5 MB). The loader in [`tfjs-embedder.ts`](../tfjs-embedder.ts) assumes exactly one shard.
- **Quantization**: 8-bit (`--quantization_bytes=1`). The 149 float32 weights are stored as `uint8` on disk and dequantized to float32 at load time; the int32 weights are unquantized. This took the payload from ~90 MB to ~22.5 MB with no change in RAG MRR (see [PR #528](https://github.com/GoogleChrome/guidance/pull/528)).
- **Embedded Operations**: The graph includes **Mean Pooling** and **L2 Normalization** layers, so the output tensor is the final normalized embedding vector.
- **Kernels**: The production bundle registers only the CPU kernels this graph uses ([`tfjs-kernels-precise.ts`](../tfjs-kernels-precise.ts)). If a regenerated graph uses a new op, add its kernel there or the bundled CLI will fail at runtime (unbundled runs load every kernel and won't catch it).

## How to Recreate

You can recreate these files using the provided `convert.py` script.

### Prerequisites
`convert.py` declares its dependencies inline (PEP 723): `tensorflow==2.15.0`, `transformers<5`, `tensorflowjs`, and `torch` (for loading PyTorch weights).

You can use `uv` to run it easily:
```bash
uv run convert.py
```

### Script Details
The `convert.py` script:
1. Loads the PyTorch weights of `all-MiniLM-L6-v2`.
2. Wraps it in a Keras model with Mean Pooling and L2 Normalization.
3. Saves it as a TensorFlow `SavedModel`.
4. Converts the `SavedModel` to a TF.js Graph Model using `tensorflowjs_converter` with `--quantization_bytes=1` and a 100 MB shard size (so it stays a single shard).
5. Cleans up intermediate files.

### Environment notes
The converter toolchain is brittle on newer Python stacks:
- `tensorflowjs` uses the `np.object` / `np.bool` aliases removed in NumPy 2.0.
- `tensorflow_hub` (needed by the converter) expects `tf.compat.v1.estimator`, which is gone in recent TensorFlow releases. That's why `convert.py` pins `tensorflow==2.15.0`.
- Older TensorFlow wheels may be unavailable on Apple Silicon. If `uv run` can't resolve the pinned versions there, run it on Linux.
