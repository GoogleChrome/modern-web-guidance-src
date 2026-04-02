import assert from 'node:assert';

export function assertSearchResults(output: string) {
    const results = JSON.parse(output);
    assert.ok(Array.isArray(results), 'Output should be a JSON array');
    assert.ok(results.length > 0, 'Search should find some results');
    
    // Find if 'autofill-address-form' is in the results
    const hasAddressForm = results.some((r: any) => r.id === 'autofill-address-form');
    assert.ok(hasAddressForm, 'Results should contain autofill-address-form');
    
    // Verify structure of the first item
    const topResult = results[0];
    assert.ok(topResult.id, 'Top result should have an id');
    assert.ok(topResult.description, 'Top result should have a description');
    assert.ok(topResult.distance, 'Top result should have a distance');
}
