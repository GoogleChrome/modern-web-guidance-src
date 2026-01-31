import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const OUTPUT = 'CODEBASE_MAP.md';

function generateMap() {
    let map = '# Codebase Map\n\nGenerated on: ' + new Date().toISOString() + '\n\n';
    
    const dirs = ['serving', 'evaluator'];
    
    dirs.forEach(dir => {
        const fullPath = path.join(ROOT, dir);
        if (fs.existsSync(fullPath)) {
            map += `## ${dir.toUpperCase()}\n\n`;
            if (dir === 'serving') {
                map += '- **MCP Server**: Located in `serving/mcp-server/` (flattened structure).\n';
                map += '- **Guides**: Source guidance in `serving/mcp-server/guides/`.\n';
            } else {
                map += '- **Evaluation Suite**: Logic in `evaluator/checks/`, scenarios in `evaluator/setup/`.\n';
            }
            map += '\n';
        }
    });

    map += '## Key Configuration Files\n\n';
    map += '- `pnpm-workspace.yaml`: Monorepo workspace config.\n';
    map += '- `.gitignore`: Unified ignore rules.\n';
    map += '- `AGENTS.md`: Instruction manual for AI agents.\n';
    map += '- `serving/tsconfig.json`: TypeScript configuration for the MCP server.\n';

    fs.writeFileSync(OUTPUT, map);
    console.log(`Codebase map generated at ${OUTPUT}`);
}

generateMap();

