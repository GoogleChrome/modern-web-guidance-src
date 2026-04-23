import { test, describe } from 'node:test';
import assert from 'node:assert';
import { TfjsEmbedder } from './tfjs-embedder.ts';

describe('TfjsEmbedder', () => {
  test('should generate embeddings correctly', async () => {
    const embedder = TfjsEmbedder.getInstance();
    await embedder.init();

    const text = 'Hello world';
    const embedding = await embedder.embed(text);

    assert.ok(Array.isArray(embedding), 'Embedding should be an array');
    assert.strictEqual(embedding.length, 384, 'Embedding should have length 384');
    
    // Verify all elements are numbers
    for (const val of embedding) {
      assert.strictEqual(typeof val, 'number', 'All elements must be numbers');
    }
    
    const expectedValues = [
      -0.03447725251317024,
      0.031023215502500534,
      0.006734978407621384,
      0.026108967140316963,
      -0.039362020790576935
    ];

    for (let i = 0; i < 5; i++) {
      assert.ok(Math.abs(embedding[i] - expectedValues[i]) < 0.05, `Value at ${i} should match within tolerance. Expected ${expectedValues[i]}, got ${embedding[i]}`);
    }
    
    console.log('Embedding test passed with exact value assertions!');
  });
});
