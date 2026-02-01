import { glob } from "glob";
import path from 'path';
import fs from 'fs';
import checkGreenfield from '../checks/greenfield.js';
import checkBrownfield from '../checks/brownfield.js';
import checkRedfield from '../checks/redfield.js';

export async function collectResults(resultsDir) {
  const runDirs = fs.readdirSync(resultsDir)
    .filter(name => {
      const fullPath = path.join(resultsDir, name);
      return fs.statSync(fullPath).isDirectory() && /^\d+$/.test(name);
    })
    .sort((a, b) => parseInt(a) - parseInt(b));

  if (runDirs.length === 0) {
    throw new Error('No test runs found!');
  }

  const allResults = {};

  for (const runDir of runDirs) {
    const runPath = path.join(resultsDir, runDir);
    
    // Structure: results/{testID}/{runNumber}/{scenario}/{type}/{agent}
    const directories = glob.sync('*/*/*/', {
      cwd: runPath,
      absolute: true
    });

    for (const dir of directories) {
      const relPath = path.relative(runPath, dir);
      const parts = relPath.split(path.sep);

      if (parts.length < 3) continue;

      const [scenario, promptType, agentType] = parts;
      const testName = `${scenario} - ${promptType} - ${agentType}`;

      const files = glob.sync('**/*', { cwd: dir, nodir: true });

      let scenarioResults = [];

      if (scenario === 'greenfield') {
        scenarioResults = checkGreenfield(dir, files);
      } else if (scenario === 'brownfield') {
        scenarioResults = checkBrownfield(dir, files);
      } else if (scenario === 'redfield') {
        scenarioResults = checkRedfield(dir, files);
      } else {
        console.warn(`Unknown scenario type: ${scenario}`);
        continue;
      }

      if (!allResults[testName]) {
        allResults[testName] = [];
      }
      allResults[testName].push({
        runNumber: parseInt(runDir),
        results: scenarioResults
      });
    }
  }

  return { allResults, numRuns: runDirs.length };
}
