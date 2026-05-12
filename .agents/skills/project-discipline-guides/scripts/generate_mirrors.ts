import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Use native Node.js .env support if available (Node 20.6.0+)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (e) {
    // .env might not exist, that's fine
  }
}

async function callCli(prompt: string, cliId: string): Promise<string> {
  const clis: Record<string, { env: string; defaultBin: string; buildArgs: (p: string) => string[] }> = {
    gemini: {
      env: 'GEMINI_CLI_BIN',
      defaultBin: 'gemini',
      buildArgs: (p) => ['-p', p, '-o', 'text', '--skip-trust'],
    },
    claude: {
      env: 'CLAUDE_CODE_CLI_BIN',
      defaultBin: 'claude',
      buildArgs: (p) => ['-p', p, '--dangerously-skip-permissions', '--output-format', 'text'],
    },
    codex: {
      env: 'CODEX_CLI_BIN',
      defaultBin: 'codex',
      buildArgs: (p) => ['exec', p],
    },
  };

  const config = clis[cliId];
  if (!config) {
    console.error(`Unknown CLI tool ID: ${cliId}`);
    return '';
  }

  const command = process.env[config.env] || config.defaultBin;
  const args = config.buildArgs(prompt);

  console.log(`Executing ${cliId} CLI: ${command} ...`);
  const result = spawnSync(command, args, { encoding: 'utf8' });

  if (result.error) {
    console.error(`Error spawning ${cliId} CLI:`, result.error);
    return '';
  }
  if (result.status !== 0) {
    console.error(`${cliId} CLI failed with exit code ${result.status}:`, result.stderr);
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

  // Load prompt template from the markdown file
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const promptTemplatePath = path.join(scriptDir, '../mirror_prompt.md');
  if (!fs.existsSync(promptTemplatePath)) {
    console.error(`Prompt template not found at: ${promptTemplatePath}`);
    process.exit(1);
  }

  const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf8');
  const prompt = promptTemplate.replace(/\{\{\s*discipline\s*\}\}/g, discipline);

  // Create mirrors/ and discipline directory inside the project-discipline-guides folder
  const mirrorsDir = path.resolve(scriptDir, '../mirrors');
  const disciplineDir = path.join(mirrorsDir, discipline.toLowerCase());
  if (!fs.existsSync(mirrorsDir)) fs.mkdirSync(mirrorsDir, { recursive: true });
  if (!fs.existsSync(disciplineDir)) fs.mkdirSync(disciplineDir, { recursive: true });

  const geminiFile = path.join(disciplineDir, 'gemini_mirror.md');
  const claudeFile = path.join(disciplineDir, 'claude_mirror.md');
  const codexFile = path.join(disciplineDir, 'codex_mirror.md');

  console.log(`--- Generating Knowledge Mirror for ${discipline} (Gemini) ---`);
  const geminiResult = await callCli(prompt, 'gemini');

  console.log(`--- Generating Knowledge Mirror for ${discipline} (Claude) ---`);
  const claudeResult = await callCli(prompt, 'claude');

  console.log(`--- Generating Knowledge Mirror for ${discipline} (Codex) ---`);
  const codexResult = await callCli(prompt, 'codex');

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
    process.exit(1);
  }

  // --- INTERSECTION STEP (all three are required core mirrors) ---
  if (!geminiResult || !claudeResult || !codexResult) {
    console.warn('⚠️ Skipping Redundancy Mirror generation because not all three mirrors were successfully generated.');
    return;
  }

  console.log(`\n--- Generating Unified Redundancy Mirror for ${discipline} ---`);
  const intersectionTemplatePath = path.join(scriptDir, '../intersection_prompt.md');
  if (!fs.existsSync(intersectionTemplatePath)) {
    console.error(`Intersection template not found at: ${intersectionTemplatePath}`);
    process.exit(1);
  }

  const intersectionTemplate = fs.readFileSync(intersectionTemplatePath, 'utf8');
  const intersectionPrompt = intersectionTemplate
    .replace(/\{\{\s*discipline\s*\}\}/g, discipline)
    .replace(/\{\{\s*gemini_mirror\s*\}\}/g, geminiResult)
    .replace(/\{\{\s*claude_mirror\s*\}\}/g, claudeResult)
    .replace(/\{\{\s*codex_mirror\s*\}\}/g, codexResult);

  // Use Gemini to perform the intersection
  const lcdResult = await callCli(intersectionPrompt, 'gemini');
  const lcdFile = path.join(disciplineDir, 'mirror.md');

  if (lcdResult) {
    fs.writeFileSync(lcdFile, lcdResult);
    console.log(`\n✅ Unified Redundancy Mirror generated:`);
    console.log(`- ${lcdFile}`);
  } else {
    console.error(`\n❌ Failed to generate Unified Redundancy Mirror.`);
  }
}

main().catch(console.error);
