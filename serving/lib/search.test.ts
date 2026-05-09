import { describe, it } from "node:test";
import assert from "node:assert";
import { searchUseCases } from "./search.ts";

describe("searchUseCases", () => {
  it("should return autofill-address-form as the best match for 'autofill address form'", async () => {
    const results = await searchUseCases("autofill address form");
    assert.ok(results.length > 0, "Should return some results");
    
    const bestMatch = results[0];
    assert.strictEqual(bestMatch.id, "autofill-address-form", "Best match should be autofill-address-form");
    
    const distance = parseFloat(bestMatch.distance as unknown as string);
    assert.ok(distance < 0.7, `Distance ${distance} should be less than 0.7`);
  });
});
