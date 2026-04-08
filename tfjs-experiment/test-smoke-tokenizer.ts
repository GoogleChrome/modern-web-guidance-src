import { AutoTokenizer } from "./dist/tokenizer.js";

async function run() {
    console.log("Testing bundled AutoTokenizer...");
    try {
        const tokenizer = await AutoTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
        const result = await tokenizer("This is a test.");
        console.log("Tokenized result:", result);
    } catch (e) {
        console.error("Error running bundled tokenizer:", e);
    }
}

run();
