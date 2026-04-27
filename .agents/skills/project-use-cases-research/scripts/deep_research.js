import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing. Please set it in your .env file.");
  process.exit(1);
}

const GEMINI_MODEL_DEEP_RESEARCH = 'deep-research-pro-preview-12-2025';
const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const { values } = parseArgs({
  options: {
    'feature-id': { type: 'string' },
    'interaction-id': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: true,
});

if (values.help || !values['feature-id']) {
  console.log(`
Usage:
  node deep_research.js --feature-id <id> [options]

Options:
  --feature-id       Name of the web feature to research (e.g. fetchlater, bfcache)
  --interaction-id   Interaction ID to resume polling for (if a run was interrupted)
  -h, --help         Show this help
`);
  process.exit(0);
}

const featureId = values['feature-id'];
const outputDir = path.resolve('features', featureId);
const outputPath = path.join(outputDir, 'research.md');

const prompt = `Thoroughly research the web platform feature '${featureId}'. 

Your goal is to provide a comprehensive research report on how developers use this feature in the real world. 
- Identify 2-5 distinct developer use cases (problems solved by this feature).
- Detail common implementation patterns, architectural trade-offs, and technical caveats.
- Provide clear code examples where applicable.
- Aim for rich data collection over tight editing; your output will be synthesized by another agent later.

**Source Prioritization Rules**:
Prioritize sources in the following sequence:
1. Chrome Authoritative Guidance: web.dev, developer.chrome.com.
2. Standard-Setting Technical Documentation: MDN Web Docs.
3. Reputable community standards (W3C Specs, WICG Proposals, reputable blogs).

Break the report down into logical sections including Overview, Use Cases, Implementation Patterns, Caveats, and Sources.`;

async function main() {
  try {
    console.log(`Creating directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });

    let id = values['interaction-id'];

    if (id) {
      console.log(`Resuming existing interaction ID: ${id}`);
    } else {
      console.log(`Starting Deep Research interaction using ${GEMINI_MODEL_DEEP_RESEARCH} for feature: ${featureId}...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          agent: GEMINI_MODEL_DEEP_RESEARCH,
          input: prompt,
          background: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini Interactions API error: ${res.status} ${res.statusText}\n${errText}`);
      }

      const { id: newId } = await res.json();
      id = newId;
    }

    console.log(`Interaction ID: ${id} — polling for completion...`);

    const POLL_INTERVAL_MS = 15_000;
    const MAX_WAIT_MS = 60 * 60 * 1000; // 60 minutes
    const start = Date.now();

    while (Date.now() - start < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const pollRes = await fetch(`${url}/${id}`, {
        headers: { 'x-goog-api-key': GEMINI_API_KEY },
      });
      if (!pollRes.ok) {
        const errText = await pollRes.text().catch(() => '');
        throw new Error(`Polling error: ${pollRes.status} ${pollRes.statusText}\n${errText}`);
      }

      const interaction = await pollRes.json();
      const status = interaction.status.toLowerCase();

      if (status === 'failed' || status === 'cancelled') {
        throw new Error(`Deep research interaction ${status}.`);
      }

      const elapsedMin = ((Date.now() - start) / 60_000).toFixed(1);
      if (status === 'completed') {
        console.log(`\nCompleted in ${elapsedMin}m`);
        const text = (interaction.outputs ?? []).map((o) => o.text ?? '').join('');
        
        fs.writeFileSync(outputPath, text, 'utf8');
        console.log(`Research report saved to ${outputPath}`);
        return;
      }

      process.stdout.write(`\rStill running… ${elapsedMin}m elapsed`);
    }

    throw new Error('Deep research timed out after 60 minutes.');
  } catch (error) {
    console.error("\nError in Deep Research script:", error.message);
    process.exit(1);
  }
}

main();
