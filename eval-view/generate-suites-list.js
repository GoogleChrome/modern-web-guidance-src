import { generateSuitesManifest } from './utils-manifest.js';

try {
  const suites = generateSuitesManifest('.');
  console.log(`Successfully generated suites manifest with ${suites.length} items.`);
} catch (e) {
  console.error('Error generating suites manifest:', e);
  process.exit(1);
}
