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

  console.log(`--- Generating Knowledge Mirror for ${discipline} (Gemini) ---`);
  const geminiResult = await callCli(prompt, 'gemini');
  const geminiFile = `mirrors/${discipline.toLowerCase()}_gemini_mirror.md`;

  console.log(`--- Generating Knowledge Mirror for ${discipline} (Claude) ---`);
  const claudeResult = await callCli(prompt, 'claude');
  const claudeFile = `mirrors/${discipline.toLowerCase()}_claude_mirror.md`;

  console.log(`--- Generating Knowledge Mirror for ${discipline} (Codex) ---`);
  const codexResult = await callCli(prompt, 'codex');
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
