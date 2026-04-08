import * as tf from "@tensorflow/tfjs";
import { AutoTokenizer } from "@huggingface/transformers";

async function run() {
    const modelUrl = "http://localhost:8080/tfjs_model_minilm/model.json";
    console.log(`Loading model from ${modelUrl}...`);
    
    try {
        const model = await tf.loadGraphModel(modelUrl);
        console.log("Model loaded successfully!");
        
        console.log("Loading tokenizer...");
        const tokenizer = await AutoTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
        
        const text = "This is a test sentence for embedding.";
        console.log(`Tokenizing: "${text}"`);
        
        const tokenized = await tokenizer(text, { padding: true, truncation: true });
        console.log("Tokenized output keys:", Object.keys(tokenized));
        
        // Let's inspect the data property of the tensors
        console.log("input_ids type:", typeof tokenized.input_ids);
        console.log("input_ids constructor:", tokenized.input_ids.constructor.name);
        
        // Extract data and convert to numbers (handling BigInt if present)
        const extractData = (tensor: any) => {
            const data = tensor.data || tensor.ort_tensor?.cpuData || tensor;
            console.log("Extracted data type:", typeof data);
            console.log("Extracted data constructor:", data?.constructor?.name);
            return Array.from(data).map((x: any) => Number(x));
        };
        
        const inputIdsData = extractData(tokenized.input_ids);
        const attentionMaskData = extractData(tokenized.attention_mask);
        const tokenTypeIdsData = extractData(tokenized.token_type_ids);
        
        console.log("Converted input_ids:", inputIdsData);
        
        // Convert to tensors
        const inputIds = tf.tensor2d([inputIdsData], undefined, 'int32');
        const attentionMask = tf.tensor2d([attentionMaskData], undefined, 'int32');
        const tokenTypeIds = tf.tensor2d([tokenTypeIdsData], undefined, 'int32');
        
        console.log("Running inference...");
        const result = model.predict({
            "input_ids": inputIds,
            "attention_mask": attentionMask,
            "token_type_ids": tokenTypeIds
        }) as tf.Tensor;
        
        console.log("Result shape:", result.shape);
        result.print();
        
        const data = await result.data();
        console.log("First 5 values:", Array.from(data).slice(0, 5));
        
    } catch (e) {
        console.error("Error running model:", e);
    }
}

run();
