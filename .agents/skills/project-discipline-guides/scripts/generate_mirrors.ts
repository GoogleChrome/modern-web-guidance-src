import fs from 'node:fs';

// Use native Node.js .env support if available (Node 20.6.0+)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (e) {
    // .env might not exist, that's fine
  }
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!ANTHROPIC_API_KEY || !GOOGLE_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY and GOOGLE_API_KEY environment variables must be set.');
  process.exit(1);
}

async function callGemini(prompt) {
  // Using gemini-3-flash as requested
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${GOOGLE_API_KEY}`;
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
  const discipline = process.argv[2];
  if (!discipline) {
    console.log('Usage: node generate_mirrors.ts <discipline_name> (e.g., "JavaScript", "CSS")');
    process.exit(1);
  }

  const prompt = `
Based on your training data and inherent knowledge of ${discipline} development, generate a comprehensive guide of standard best practices, syntax, and APIs that you natively understand and would apply by default.

Focus on:
1. Modern language features (ES2022+ for JS, etc.).
2. Standard library/API usage.
3. Common clean code principles.

This guide will be used as a "Redundancy Mirror" to prune a project-specific skill file. 
We want to see exactly what you consider "Common Knowledge" so we can delete it from our local guides.
`.trim();

  console.log(`--- Generating Knowledge Mirror for ${discipline} (Gemini 3 Flash) ---`);
  const geminiResult = await callGemini(prompt);
  const geminiFile = `mirrors/${discipline.toLowerCase()}_gemini_mirror.md`;
  
  console.log(`--- Generating Knowledge Mirror for ${discipline} (Claude 3.5 Sonnet) ---`);
  const claudeResult = await callClaude(prompt);
  const claudeFile = `mirrors/${discipline.toLowerCase()}_claude_mirror.md`;

  if (!fs.existsSync('mirrors')) fs.mkdirSync('mirrors');
  
  fs.writeFileSync(geminiFile, geminiResult);
  fs.writeFileSync(claudeFile, claudeResult);

  console.log(`\n✅ Knowledge Mirrors generated:`);
  console.log(`- ${geminiFile}`);
  console.log(`- ${claudeFile}`);
}

main().catch(console.error);
