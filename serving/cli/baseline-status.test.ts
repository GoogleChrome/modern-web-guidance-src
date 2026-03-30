import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
const scriptPath = path.resolve(import.meta.dirname, './baseline-status.ts');

describe('baseline-status CLI', () => {
  const runCLI = (args: string[]) => {
    const result = spawnSync('node', ['--experimental-strip-types', scriptPath, ...args], {
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' } // Ensure no colors in tests
    });
    return result;
  };

  it('prints usage when no arguments provided', () => {
    const { stdout } = runCLI([]);
    expect(stdout).toContain('Usage: pnpm baselinestatus');
  });

  it('filters by query and outputs markdown table', () => {
    const { stdout } = runCLI(['overflow']);
    expect(stdout).toContain('| web-feature-id');
    expect(stdout).toContain('| overflow ');
    expect(stdout).toContain('| overflow-clip ');
  });

  it('outputs JSON when --json flag is provided', () => {
    const { stdout } = runCLI(['overflow', '--json']);
    const data = JSON.parse(stdout);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('featureId');
    expect(data[0]).toHaveProperty('baseline');
  });

  it('outputs empty array for no matches in JSON mode', () => {
    const { stdout } = runCLI(['nonexistentfeaturexyz', '--json']);
    expect(stdout.trim()).toBe('[]');
  });

  it('omits Safari iOS column when versions match', () => {
    const { stdout } = runCLI(['overflow-clip']);
    expect(stdout).toContain('Safari');
    expect(stdout).not.toContain('Safari iOS');
  });

  it('includes Safari iOS column when versions differ', () => {
    const { stdout } = runCLI(['async-clipboard']);
    expect(stdout).toContain('Safari');
    expect(stdout).toContain('Safari iOS');
  });
});
