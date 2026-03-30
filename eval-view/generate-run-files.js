import fs from 'fs';
import path from 'path';

const resultsDir = path.resolve('../harness/results');

function scanDir(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    let hasSubDirs = false;

    for (const item of items) {
        if (item.isDirectory()) {
            hasSubDirs = true;
            scanDir(path.join(dir, item.name));
        } else if (item.isFile() && item.name !== 'run-files.json') {
            files.push(item.name);
        }
    }

    // If it's a leaf directory (or has files), write run-files.json
    if (files.length > 0) {
        const manifestPath = path.join(dir, 'run-files.json');
        fs.writeFileSync(manifestPath, JSON.stringify({ files }, null, 2));
        // console.log(`Generated manifest for ${dir}`);
    }
}

try {
    if (fs.existsSync(resultsDir)) {
        console.log(`Scanning results in ${resultsDir} to generate run-files.json manifests...`);
        scanDir(resultsDir);
        console.log('Successfully generated run-files.json manifests.');
    } else {
        console.warn(`Results directory ${resultsDir} not found.`);
    }
} catch (e) {
    console.error('Error generating run-files.json manifests:', e);
}
