import fs from 'fs';
import path from 'path';

const resultsDir = path.resolve('../harness/results');
const outputFilePath = path.resolve('./suites.json');

const suites = [];

function scanResults() {
  if (!fs.existsSync(resultsDir)) {
      console.log(`Results directory ${resultsDir} not found.`);
      return;
  }

  const items = fs.readdirSync(resultsDir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
       const suiteDir = path.join(resultsDir, item.name);
       const evalsPath = path.join(suiteDir, 'evals.json');
       if (fs.existsSync(evalsPath)) {
           suites.push(item.name);
       }
    }
  }
}

try {
  scanResults();
  
  // Sort suites alphabetically or by date if possible (assuming suite IDs might have a naming convention, or alphanumeric is fine)
  suites.sort();

  fs.writeFileSync(outputFilePath, JSON.stringify(suites, null, 2));
  console.log(`Successfully generated suites manifest at ${outputFilePath}`);
} catch (e) {
  console.error('Error generating suites manifest:', e);
}
