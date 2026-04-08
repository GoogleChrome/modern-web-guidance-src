import * as tf from "@tensorflow/tfjs";
import { AutoTokenizer } from "./dist/tokenizer.js";
import { spawn } from "child_process";
import path from "path";

async function run() {
    const port = 8086;
    console.log(`Starting HTTP server on port ${port}...`);
    
    // The model is in serving/benchmarks/rag/tfjs_model_minilm
    // So we need to serve serving/benchmarks/rag directory!
    const serveDir = path.resolve("../serving/benchmarks/rag");
    
    const server = spawn("python3", ["-m", "http.server", port.toString()], {
        cwd: serveDir,
        stdio: "ignore"
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const modelUrl = `http://localhost:${port}/tfjs_model_minilm/model.json`;
    console.log(`Loading model from ${modelUrl}...`);
    
    try {
        const model = await tf.loadGraphModel(modelUrl);
        console.log("Model loaded successfully!");
        
        console.log("Loading tokenizer from bundle...");
        const tokenizer = await AutoTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
        
        const text = "This is a test sentence for the full pipeline.";
        console.log(`Tokenizing: "${text}"`);
        
        const tokenized = await tokenizer(text, { padding: true, truncation: true });
        
        // Extract data and convert to numbers
        const extractData = (tensor: any) => {
            const data = tensor.data || tensor.ort_tensor?.cpuData || tensor;
            return Array.from(data).map((x: any) => Number(x));
        };
        
        const inputIdsData = extractData(tokenized.input_ids);
        const attentionMaskData = extractData(tokenized.attention_mask);
        const tokenTypeIdsData = extractData(tokenized.token_type_ids);
        
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
        console.error("Error in full pipeline:", e);
    } finally {
        console.log("Stopping server...");
        server.kill();
    }
}

run();
