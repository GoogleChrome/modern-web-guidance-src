import fs from 'fs';
import path from 'path';

const resultsDir = path.resolve('../harness/results');

export function generateSuitesManifest(outputDir = '.') {
    const suites = [];
    if (!fs.existsSync(resultsDir)) return [];

    const items = fs.readdirSync(resultsDir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            const suiteDir = path.join(resultsDir, item.name);
            if (fs.existsSync(path.join(suiteDir, 'evals.json'))) {
                suites.push(item.name);
            }
        }
    }
    suites.sort();
    const outputPath = path.join(outputDir, 'suites.gen.json');
    fs.writeFileSync(outputPath, JSON.stringify(suites, null, 2));
    return suites;
}

export function generateRunFilesManifests(targetDir = resultsDir) {
    if (!fs.existsSync(targetDir)) return;

    const items = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = [];

    for (const item of items) {
        if (item.isDirectory()) {
            generateRunFilesManifests(path.join(targetDir, item.name));
        } else if (item.isFile() && item.name !== 'run-files.gen.json') {
            files.push(item.name);
        }
    }

    if (files.length > 0) {
        const manifestPath = path.join(targetDir, 'run-files.gen.json');
        fs.writeFileSync(manifestPath, JSON.stringify({ files }, null, 2));
    }
}
