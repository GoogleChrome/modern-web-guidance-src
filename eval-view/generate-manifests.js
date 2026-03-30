import { generateMapping, generateSuitesManifest, generateRunFilesManifests } from './utils-manifest.js';

const args = process.argv.slice(2);
const resultsOnly = args.includes('--results-only');

try {
  if (!resultsOnly) {
    console.log('🔄 Generating features mapping...');
    generateMapping('.');
  }

  console.log('🔄 Generating suites and run-files manifests...');
  generateSuitesManifest('.');
  generateRunFilesManifests();
  
  console.log('✅ All manifests generated successfully.');
} catch (e) {
  console.error('❌ Error generating manifests:', e);
  process.exit(1);
}
