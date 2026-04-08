# /// script
# dependencies = [
#   "tensorflow",
#   "transformers<5",
#   "tensorflowjs",
#   "torch",
#   "numpy==1.26.4",
#   "tf-keras",
# ]
# ///

import tensorflow as tf
from transformers import TFAutoModel
import os
import subprocess

def create_model():
    # Load model
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    print(f"Loading model {model_name}...")
    base_model = TFAutoModel.from_pretrained(model_name, use_safetensors=False)
    
    # Create wrapper model with pooling and normalization
    input_ids = tf.keras.layers.Input(shape=(None,), dtype=tf.int32, name="input_ids")
    attention_mask = tf.keras.layers.Input(shape=(None,), dtype=tf.int32, name="attention_mask")
    
    outputs = base_model(input_ids, attention_mask=attention_mask)
    token_embeddings = outputs.last_hidden_state
    
    # Mean pooling
    input_mask_expanded = tf.cast(
        tf.expand_dims(attention_mask, -1), tf.float32
    )
    sum_embeddings = tf.reduce_sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = tf.reduce_sum(input_mask_expanded, 1)
    sum_mask = tf.clip_by_value(sum_mask, 1e-9, tf.float32.max)
    mean_embeddings = sum_embeddings / sum_mask
    
    # L2 normalization
    normalized_embeddings = tf.math.l2_normalize(mean_embeddings, axis=1)
    
    model = tf.keras.Model(
        inputs=[input_ids, attention_mask], 
        outputs=normalized_embeddings
    )
    
    return model

def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    saved_model_path = os.path.join(current_dir, "saved_model_q8")
    output_path = os.path.join(current_dir, "tfjs_model_q8")
    
    print(f"Working directory: {current_dir}")
    print(f"Saved model path: {saved_model_path}")
    print(f"Output path: {output_path}")
    
    model = create_model()
    
    print(f"Saving Keras model to {saved_model_path}...")
    model.save(saved_model_path)
    
    print(f"Converting to TFJS (Q8)...")
    # Convert to TFJS
    subprocess.run([
        "tensorflowjs_converter",
        "--input_format=tf_saved_model",
        "--output_format=tfjs_graph_model",
        "--quantization_bytes=1", # 8-bit quantization
        saved_model_path,
        output_path
    ], check=True)
    
    print("Done! Model saved to tfjs_model_q8")

if __name__ == "__main__":
    main()
