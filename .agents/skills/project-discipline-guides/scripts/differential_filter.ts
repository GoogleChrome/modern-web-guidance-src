import fs from 'node:fs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!ANTHROPIC_API_KEY || !GOOGLE_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY and GOOGLE_API_KEY environment variables must be set.');
  process.exit(1);
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callClaude(prompt) {
  const url = 'https://api.anthropic.com/v1/messages';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node differential_filter.ts <target_file> <source_file_1> [source_file_2 ...]');
    process.exit(1);
  }

  const targetPath = args[0];
  const sourcePaths = args.slice(1);

  const targetContent = fs.readFileSync(targetPath, 'utf8');
  const sourcesContent = sourcePaths.map(p => `--- SOURCE: ${p} ---\n${fs.readFileSync(p, 'utf8')}`).join('\n\n');

  const prompt = `
You are an expert technical editor performing a "Differential Knowledge Refactor".

GOAL:
Identify redundancies in the TARGET document that are already well-covered in the PROVIDED SOURCES. 
We want to keep the TARGET document "strictly additive" (Differential Knowledge).

TARGET DOCUMENT:
${targetContent}

PROVIDED SOURCES:
${sourcesContent}

INSTRUCTIONS:
1. Analyze every rule, syntax pattern, and best practice in the TARGET.
2. If an item is already covered in the SOURCES, it is "Standard Knowledge" and should be REMOVED.
3. If an item is NOT in the sources (e.g., project-specific steering, advanced heuristics, or behavioral counter-biases), it should be KEPT.
4. Output ONLY the refactored version of the TARGET document. Maintain the original structure but prune the redundancies.
`.trim();

  console.log('--- Calling Gemini 1.5 Flash ---');
  const geminiResult = await callGemini(prompt);
  
  console.log('--- Calling Claude 3.5 Sonnet ---');
  const claudeResult = await callClaude(prompt);

  // We'll output both for the user to compare, or we could do a merge.
  // For now, let's output them to separate files or just stdout.
  console.log('\n\n=== REFACTORED CONTENT (GEMINI FLASH) ===\n');
  console.log(geminiResult);
  console.log('\n\n=== REFACTORED CONTENT (CLAUDE SONNET) ===\n');
  console.log(claudeResult);
}

main().catch(console.error);
