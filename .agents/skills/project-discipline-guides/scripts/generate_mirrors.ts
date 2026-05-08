import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

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

if (!ANTHROPIC_API_KEY) {
  console.warn('Warning: ANTHROPIC_API_KEY environment variable is not set. Claude mirror may fail.');
}
if (!GOOGLE_API_KEY) {
  console.warn('Warning: GOOGLE_API_KEY environment variable is not set. Gemini mirror may fail.');
}

async function callGemini(prompt) {
  const command = process.env.GEMINI_CLI_BIN || 'gemini';
  console.log(`Executing Gemini CLI: ${command} ...`);
  const result = spawnSync(command, ['-p', prompt, '-o', 'text', '--yolo', '--skip-trust'], { encoding: 'utf8' });
  if (result.error) {
    console.error('Error spawning Gemini CLI:', result.error);
    return '';
  }
  if (result.status !== 0) {
    console.error(`Gemini CLI failed with exit code ${result.status}:`, result.stderr);
    return '';
  }
  return result.stdout || '';
}

async function callClaude(prompt) {
  const command = process.env.CLAUDE_CODE_CLI_BIN || 'claude';
  console.log(`Executing Claude CLI: ${command} ...`);
  const result = spawnSync(command, ['-p', prompt, '--dangerously-skip-permissions', '--output-format', 'text'], { encoding: 'utf8' });
  if (result.error) {
    console.error('Error spawning Claude CLI:', result.error);
    return '';
  }
  if (result.status !== 0) {
    console.error(`Claude CLI failed with exit code ${result.status}:`, result.stderr);
    return '';
  }
  return result.stdout || '';
}

async function callCodexCLI(prompt) {
  const command = process.env.CODEX_CLI_BIN || 'codex';
  console.log(`Executing Codex CLI: ${command} exec ...`);
  const result = spawnSync(command, ['exec', prompt, '--yolo'], { encoding: 'utf8' });
  if (result.error) {
    console.error('Error spawning Codex CLI:', result.error);
    return '';
  }
  if (result.status !== 0) {
    console.error(`Codex CLI failed with exit code ${result.status}:`, result.stderr);
    return '';
  }
  return result.stdout || '';
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

  console.log(`--- Generating Knowledge Mirror for ${discipline} (Gemini) ---`);
  const geminiResult = await callGemini(prompt);
  const geminiFile = `mirrors/${discipline.toLowerCase()}_gemini_mirror.md`;

  console.log(`--- Generating Knowledge Mirror for ${discipline} (Claude) ---`);
  const claudeResult = await callClaude(prompt);
  const claudeFile = `mirrors/${discipline.toLowerCase()}_claude_mirror.md`;

  console.log(`--- Generating Knowledge Mirror for ${discipline} (Codex CLI) ---`);
  const codexResult = await callCodexCLI(prompt);
  const codexFile = `mirrors/${discipline.toLowerCase()}_codex_mirror.md`;

  if (!fs.existsSync('mirrors')) fs.mkdirSync('mirrors');
  
  const generatedFiles = [];

  if (geminiResult) {
    fs.writeFileSync(geminiFile, geminiResult);
    generatedFiles.push(geminiFile);
  } else {
    console.warn(`⚠️ Skipping ${geminiFile} due to failure.`);
  }

  if (claudeResult) {
    fs.writeFileSync(claudeFile, claudeResult);
    generatedFiles.push(claudeFile);
  } else {
    console.warn(`⚠️ Skipping ${claudeFile} due to failure.`);
  }

  if (codexResult) {
    fs.writeFileSync(codexFile, codexResult);
    generatedFiles.push(codexFile);
  } else {
    console.warn(`⚠️ Skipping ${codexFile} due to failure.`);
  }

  if (generatedFiles.length > 0) {
    console.log(`\n✅ Knowledge Mirrors generated:`);
    generatedFiles.forEach(file => console.log(`- ${file}`));
  } else {
    console.error(`\n❌ No Knowledge Mirrors were successfully generated.`);
  }
}

main().catch(console.error);
