import { generateRunFilesManifests } from './utils-manifest.js';

try {
  console.log('Scanning results to generate run-files.gen.json manifests...');
  generateRunFilesManifests();
  console.log('Successfully generated run-files.gen.json manifests.');
} catch (e) {
  console.error('Error generating run-files.gen.json manifests:', e);
  process.exit(1);
}
