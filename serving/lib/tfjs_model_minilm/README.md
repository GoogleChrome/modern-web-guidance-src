# TensorFlow.js all-MiniLM-L6-v2 Model

This directory contains the `all-MiniLM-L6-v2` model converted to TensorFlow.js Graph Model format.

## Model Details
- **Source Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **Format**: TensorFlow.js Graph Model (sharded)
- **Quantization**: **None** (Float32). This ensures maximum accuracy parity with the original model.
- **Embedded Operations**: The graph includes **Mean Pooling** and **L2 Normalization** layers, so the output tensor is the final normalized embedding vector.

## How to Recreate

You can recreate these files using the provided `convert.py` script.

### Prerequisites
You need Python with the following dependencies:
- `tensorflow==2.15.0`
- `transformers`
- `tensorflowjs`
- `torch` (for loading PyTorch weights)

You can use `uv` to run it easily:
```bash
uv run convert.py
```

### Script Details
The `convert.py` script:
1. Loads the PyTorch weights of `all-MiniLM-L6-v2`.
2. Wraps it in a Keras model with Mean Pooling and L2 Normalization.
3. Saves it as a TensorFlow `SavedModel`.
4. Converts the `SavedModel` to a TF.js Graph Model using `tensorflowjs_converter`.
5. Cleans up intermediate files.

## Quantized (Q8) Attempt

We attempted to create an 8-bit quantized version of this model using `--quantization_bytes=1` in `tensorflowjs_converter`. 

The script is available as `convert_q8_broken.py`.

### Why it failed in our environment:
We hit intense **Python dependency conflicts** on our environment (Mac Apple Silicon):
1. **NumPy 2.0 Incompatibility**: `tensorflowjs` uses deprecated aliases `np.object` and `np.bool` which were removed in NumPy 2.0. We worked around this by monkey patching them in the script.
2. **TensorFlow Hub vs TF 2.x**: `tensorflow_hub` (needed by the converter) expects `tf.compat.v1.estimator`, which has been completely removed in the latest TensorFlow (2.21.0).
3. **Mac ARM Wheel Limits**: We couldn't easily downgrade TensorFlow to an older version (like 2.12 or 2.13) because those versions lack native wheels for **Apple Silicon (Mac ARM)**.

### Potential Fix:
This script **should work on Intel Macs or Linux machines** where older versions of TensorFlow (e.g., 2.12.0) are readily installable via `pip`. If run on those platforms, it should produce a functional Q8 model.
