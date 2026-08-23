import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import config from '../config.ts';
import { runAgent } from '../../guides/lib/utils.ts';
import { getDefaultSolutionAgent } from '../../lib/guide-validation.ts';

describe('runAgent routing and argument building', () => {
  let tempDir: string;
  let mockCliPath: string;
  let originalGeminiCli: string;
  let originalJetskiCli: string;
  let originalGdUseGemini: string | undefined;

  before(() => {
    // Create temporary directory and mock CLI
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-agent-cli-'));
    mockCliPath = path.join(tempDir, 'mock-cli');
    
    // The mock CLI script prints its arguments to stdout
    const scriptContent = `#!/bin/sh
echo "mock-cli ran with args: $@"
`;
    fs.writeFileSync(mockCliPath, scriptContent, { mode: 0o755 });

    // Backup original configs
    originalGeminiCli = config.environment.geminiCliBin;
    originalJetskiCli = config.environment.jetskiCliBin;
    originalGdUseGemini = process.env.GD_DEV_USE_GEMINI;

    // Override config paths to point to the mock CLI
    config.environment.geminiCliBin = mockCliPath;
    config.environment.jetskiCliBin = mockCliPath;
  });

  after(() => {
    // Restore config paths and environment variables
    config.environment.geminiCliBin = originalGeminiCli;
    config.environment.jetskiCliBin = originalJetskiCli;
    
    if (originalGdUseGemini === undefined) {
      delete process.env.GD_DEV_USE_GEMINI;
    } else {
      process.env.GD_DEV_USE_GEMINI = originalGdUseGemini;
    }

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should invoke Jetski CLI by default without --yolo', async () => {
    delete process.env.GD_DEV_USE_GEMINI;
    
    const output = await runAgent(getDefaultSolutionAgent(), 'hello world', tempDir, { captureOutput: true });
    assert.ok(output.includes('mock-cli ran with args: -p hello world'));
    assert.ok(!output.includes('--yolo'));
  });

  test('should invoke Gemini CLI when GD_DEV_USE_GEMINI=1', async () => {
    process.env.GD_DEV_USE_GEMINI = '1';

    try {
      const output = await runAgent(getDefaultSolutionAgent(), 'hello world', tempDir, { captureOutput: true });
      assert.ok(output.includes('mock-cli ran with args: -p hello world --yolo'));
    } finally {
      delete process.env.GD_DEV_USE_GEMINI;
    }
  });
});
