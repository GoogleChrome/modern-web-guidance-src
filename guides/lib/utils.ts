import { spawn } from 'node:child_process';
import path from 'node:path';
import config from '../../harness/config.ts';

export async function runCommand(command: string, args: string[], cwd?: string): Promise<string> {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdoutData = '';
  let stderrData = '';
  child.stdout.on('data', (d) => { stdoutData += d; });
  child.stderr.on('data', (d) => { stderrData += d; });

  const exitCode = await new Promise<number | null>(resolve => child.on('close', resolve));

  if (exitCode !== 0) {
    throw new Error(`Command ${command} failed with code ${exitCode}. Stderr: ${stderrData}`);
  }

  return stdoutData.trim();
}

export async function runGemini(prompt: string, workDir?: string): Promise<string> {
  const command = config.environment.geminiCliBin;
  const commandArgs = ['-p', prompt, '--yolo'];
  return runCommand(command, commandArgs, workDir);
}
