import { describe, it } from "node:test";
import assert from "node:assert";
import { searchUseCases } from "./search.ts";

describe("searchUseCases", () => {
  it("should return autofill-address-form as the best match for 'autofill address form'", async () => {
    const results = await searchUseCases("autofill address form");
    assert.ok(results.length > 0, "Should return some results");
    
    const bestMatch = results[0];
    assert.strictEqual(bestMatch.id, "autofill-address-form", "Best match should be autofill-address-form");
    
    const similarity = bestMatch.similarity;
    assert.ok(similarity > 0.3, `Similarity ${similarity} should be greater than 0.3`);
    assert.ok(bestMatch.tokenCount > 0, 'Best match should have tokenCount > 0');
  });
});
