import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import config from '../config.ts';
import { runAgentForModel } from '../../guides/lib/utils.ts';
import { getDefaultSolutionAgent } from '../../lib/guide-validation.ts';

describe('runAgentForModel routing and argument building', () => {
  let tempDir: string;
  let mockCliPath: string;
  let originalGeminiCli: string;
  let originalJetskiCli: string;
  let originalGdUseJetski: string | undefined;

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
    originalGdUseJetski = process.env.GD_DEV_USE_JETSKI;

    // Override config paths to point to the mock CLI
    config.environment.geminiCliBin = mockCliPath;
    config.environment.jetskiCliBin = mockCliPath;
  });

  after(() => {
    // Restore config paths and environment variables
    config.environment.geminiCliBin = originalGeminiCli;
    config.environment.jetskiCliBin = originalJetskiCli;
    
    if (originalGdUseJetski === undefined) {
      delete process.env.GD_DEV_USE_JETSKI;
    } else {
      process.env.GD_DEV_USE_JETSKI = originalGdUseJetski;
    }

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should invoke Gemini CLI by default with --yolo', async () => {
    delete process.env.GD_DEV_USE_JETSKI;
    
    const output = await runAgentForModel(getDefaultSolutionAgent(), 'hello world', tempDir, { captureOutput: true });
    assert.ok(output.includes('mock-cli ran with args: -p hello world --yolo'));
  });

  test('should invoke Jetski CLI when GD_DEV_USE_JETSKI=1', async () => {
    process.env.GD_DEV_USE_JETSKI = '1';

    try {
      const output = await runAgentForModel(getDefaultSolutionAgent(), 'hello world', tempDir, { captureOutput: true });
      assert.ok(output.includes('mock-cli ran with args: -p hello world'));
      assert.ok(!output.includes('--yolo'));
    } finally {
      delete process.env.GD_DEV_USE_JETSKI;
    }
  });
});
