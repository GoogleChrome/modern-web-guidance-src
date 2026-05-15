import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { detectOS, bucketizeLatency, ClearcutLogger } from './ClearcutLogger.ts';
import { OsType, CommandType } from './types.ts';
import { WatchdogClient } from './WatchdogClient.ts';

describe('detectOS', () => {
  const expectedOS =
    process.platform === 'darwin'
      ? OsType.MACOS
      : process.platform === 'win32'
        ? OsType.WINDOWS
        : process.platform === 'linux'
          ? OsType.LINUX
          : OsType.UNSPECIFIED;

  it('detects current operating system correctly', () => {
    assert.strictEqual(detectOS(), expectedOS);
  });
});

describe('bucketizeLatency', () => {
  it('groups latency into correct discrete buckets', () => {
    assert.strictEqual(bucketizeLatency(3), 5);
    assert.strictEqual(bucketizeLatency(10), 15);
    assert.strictEqual(bucketizeLatency(25), 50);
    assert.strictEqual(bucketizeLatency(50), 50);
    assert.strictEqual(bucketizeLatency(75), 100);
    assert.strictEqual(bucketizeLatency(249), 250);
    assert.strictEqual(bucketizeLatency(499), 500);
    assert.strictEqual(bucketizeLatency(800), 1000);
    assert.strictEqual(bucketizeLatency(2000), 2500);
    assert.strictEqual(bucketizeLatency(4500), 5000);
    assert.strictEqual(bucketizeLatency(8000), 10000);
    assert.strictEqual(bucketizeLatency(15000), 10000);
  });
});

describe('ClearcutLogger', () => {
  it('disables telemetry case-insensitively when DISABLE_TELEMETRY is set to True', async () => {
    const originalEnv = process.env.DISABLE_TELEMETRY;
    const sendMock = mock.method(WatchdogClient.prototype, 'send', () => {});

    try {
      process.env.DISABLE_TELEMETRY = 'True';
      const logger = new ClearcutLogger();
      await logger.logToolCommand(120, true, CommandType.INSTALL);
      assert.strictEqual(sendMock.mock.calls.length, 0, 'WatchdogClient.send should not be called when telemetry is disabled');
    } finally {
      sendMock.mock.restore();
      if (originalEnv !== undefined) {
        process.env.DISABLE_TELEMETRY = originalEnv;
      } else {
        delete process.env.DISABLE_TELEMETRY;
      }
    }
  });

  it('logs tool command results correctly via watchdog', async () => {
    const sentMessages: any[] = [];
    const sendMock = mock.method(WatchdogClient.prototype, 'send', (msg: any) => {
      sentMessages.push(msg);
    });

    try {
      const logger = new ClearcutLogger({ skillVersion: '2026_05_14-abc' });
      await logger.logToolCommand(120, true, CommandType.INSTALL);

      assert.ok(sentMessages.length > 0, 'Should send at least one message to watchdog');
      const payload = sentMessages[sentMessages.length - 1].payload;
      assert.deepStrictEqual(payload.tool_command, { command_type: CommandType.INSTALL });
      assert.strictEqual(payload.success, true);
      assert.strictEqual(payload.latency_ms, 250); // 120 bucketized to 250
      assert.strictEqual(payload.skill_version, '2026_05_14-abc');
    } finally {
      sendMock.mock.restore();
    }
  });

  it('logs retrieve results correctly via watchdog', async () => {
    const sentMessages: any[] = [];
    const sendMock = mock.method(WatchdogClient.prototype, 'send', (msg: any) => {
      sentMessages.push(msg);
    });

    try {
      const logger = new ClearcutLogger({ skillVersion: '2026_05_14-xyz' });
      await logger.logRetrieveResult(300, false, 'guide-id-1');

      assert.ok(sentMessages.length > 0, 'Should send at least one message to watchdog');
      const payload = sentMessages[sentMessages.length - 1].payload;
      assert.strictEqual(payload.retrieve_result.guide_id, 'guide-id-1');
      assert.strictEqual(payload.success, false);
      assert.strictEqual(payload.latency_ms, 500); // 300 bucketized to 500
      assert.strictEqual(payload.skill_version, '2026_05_14-xyz');
    } finally {
      sendMock.mock.restore();
    }
  });
});

describe('Installation output parser regex', () => {
  const sampleStdout = `
┌   skills 
│
◇  Source: https://github.com/vercel-labs/agent-skills.git
│
◇  Found 7 skills
│
✓ Preflight check passed -- this check should not be parsed as a skill!
│
◇  Installed 2 skills ───────────────────────────────╮
│                                                    │
│  ✓ deploy-to-vercel (copied)                       │
│    → ~/.agents/skills/deploy-to-vercel             │
│  ✓ vercel-react-best-practices (copied)            │
│    → ~/.agents/skills/vercel-react-best-practices  │
│                                                    │
├────────────────────────────────────────────────────╯
  `;

  it('extracts successfully installed skills strictly from the Installed summary box', () => {
    /* eslint-disable-next-line no-control-regex */
    const cleanOutput = sampleStdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    const skills: string[] = [];

    const installedBoxMatch = cleanOutput.match(/Installed \d+ skill[\s\S]*?├─/);
    assert.ok(installedBoxMatch, 'Should locate the installed skills summary block');

    const boxContent = installedBoxMatch[0];
    const regex = /✓\s*([a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = regex.exec(boxContent)) !== null) {
      skills.push(match[1]);
    }

    assert.deepStrictEqual(skills, ['deploy-to-vercel', 'vercel-react-best-practices']);
  });
});
