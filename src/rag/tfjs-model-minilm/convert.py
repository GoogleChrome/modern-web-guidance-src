# /// script
# dependencies = [
#   "tensorflow==2.15.0",
#   "transformers<5",
#   "tensorflowjs",
#   "torch",
# ]
# ///

import tensorflow as tf
from transformers import TFAutoModel
import os
import subprocess

def create_model():
    model_id = 'sentence-transformers/all-MiniLM-L6-v2'
    print(f"Loading model {model_id} from PyTorch weights...")
    base_model = TFAutoModel.from_pretrained(model_id, from_pt=True)
    
    # Define inputs
    input_ids = tf.keras.Input(shape=(None,), dtype=tf.int32, name="input_ids")
    attention_mask = tf.keras.Input(shape=(None,), dtype=tf.int32, name="attention_mask")
    token_type_ids = tf.keras.Input(shape=(None,), dtype=tf.int32, name="token_type_ids")
    
    # Forward pass
    outputs = base_model(input_ids=input_ids, attention_mask=attention_mask, token_type_ids=token_type_ids)
    
    # Mean pooling
    token_embeddings = outputs[0]
    input_mask_expanded = tf.cast(
        tf.broadcast_to(tf.expand_dims(attention_mask, -1), tf.shape(token_embeddings)),
        tf.float32
    )
    sum_embeddings = tf.math.reduce_sum(token_embeddings * input_mask_expanded, axis=1)
    sum_mask = tf.clip_by_value(tf.math.reduce_sum(input_mask_expanded, axis=1), 1e-9, tf.float32.max)
    embeddings = sum_embeddings / sum_mask
    
    # Normalize
    normalized_embeddings = tf.linalg.l2_normalize(embeddings, axis=1)
    
    model = tf.keras.Model(
        inputs={"input_ids": input_ids, "attention_mask": attention_mask, "token_type_ids": token_type_ids},
        outputs=normalized_embeddings
    )
    return model

def main():
    try:
        model = create_model()
        saved_model_path = "saved_model_minilm_dir"
        
        print(f"Saving Keras model to SavedModel directory {saved_model_path}...")
        model.save(saved_model_path)
        
        output_dir = "model_output"
        print(f"Converting to TensorFlow.js Graph Model in {output_dir}...")
        
        subprocess.run([
            "tensorflowjs_converter",
            "--input_format=tf_saved_model",
            "--weight_shard_size_bytes=100000000",
            "--quantization_bytes=1",
            saved_model_path,
            output_dir
        ], check=True)
        
        # Move files to current directory
        import glob
        print(f"Moving files from {output_dir} to current directory...")
        for file in glob.glob(os.path.join(output_dir, "*")):
            dest = os.path.basename(file)
            if os.path.exists(dest):
                os.remove(dest)
            os.rename(file, dest)
        os.rmdir(output_dir)
        
        print("Conversion complete!")
        
        # Cleanup intermediate SavedModel
        import shutil
        print(f"Cleaning up {saved_model_path}...")
        shutil.rmtree(saved_model_path)
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
