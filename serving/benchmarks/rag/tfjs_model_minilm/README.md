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
