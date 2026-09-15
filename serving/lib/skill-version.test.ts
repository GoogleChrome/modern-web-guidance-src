import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseVersionDate, parseVersionSha, checkSkillUpdate } from './skill-version.ts';

describe('skill-version', () => {
  describe('parseVersionDate', () => {
    it('parses valid date prefix in UTC', () => {
      const date = parseVersionDate('2026_05_16-c5e7870');
      assert.notEqual(date, null);
      assert.equal(date?.getUTCFullYear(), 2026);
      assert.equal(date?.getUTCMonth(), 4); // 0-indexed (May is 4)
      assert.equal(date?.getUTCDate(), 16);
    });

    it('handles whitespace in version string', () => {
      const date = parseVersionDate('  2026_05_16-c5e7870 \n');
      assert.notEqual(date, null);
      assert.equal(date?.getUTCDate(), 16);
    });

    it('returns null for invalid date prefix', () => {
      assert.equal(parseVersionDate('invalid-version'), null);
      assert.equal(parseVersionDate(''), null);
      assert.equal(parseVersionDate('2026_13_01'), null); // invalid month
    });
  });

  describe('parseVersionSha', () => {
    it('extracts sha from version string in lowercase', () => {
      assert.equal(parseVersionSha('2026_05_16-c5e7870'), 'c5e7870');
      assert.equal(parseVersionSha('2026_05_16-C5E7870'), 'c5e7870');
      assert.equal(parseVersionSha('2026_08_31-6ba3cecd'), '6ba3cecd');
    });

    it('rejects short suffixes under 7 hex characters', () => {
      assert.equal(parseVersionSha('2026_05_16-1'), null);
      assert.equal(parseVersionSha('2026_05_16-abc'), null);
      assert.equal(parseVersionSha('2026_05_16-123456'), null);
      assert.equal(parseVersionSha('2026_05_16-1234567'), '1234567');
    });

    it('returns null if no sha is present', () => {
      assert.equal(parseVersionSha('2026_05_16'), null);
      assert.equal(parseVersionSha('invalid'), null);
    });
  });

  describe('checkSkillUpdate', () => {
    it('does not warn if either version is null', () => {
      assert.equal(checkSkillUpdate(null, '2026_05_16-c5e78707').warn, false);
      assert.equal(checkSkillUpdate('2026_05_16-c5e78707', null).warn, false);
    });

    it('does not warn if versions are identical', () => {
      const res = checkSkillUpdate('2026_05_16-c5e78707', '2026_05_16-c5e78707');
      assert.equal(res.warn, false);
    });

    it('tolerates whitespace around version strings', () => {
      const res = checkSkillUpdate('  2026_05_16-c5e78707 \n', '2026_05_16-c5e78707');
      assert.equal(res.warn, false);
    });

    it('does not warn if SHAs match via prefix (7-char vs 8-char of same commit)', () => {
      const res1 = checkSkillUpdate('2026_05_16-c5e7870', '2026_05_16-c5e78707');
      assert.equal(res1.warn, false);

      const res2 = checkSkillUpdate('2026_05_16-c5e78707', '2026_05_16-c5e7870');
      assert.equal(res2.warn, false);
    });

    it('matches SHAs case-insensitively', () => {
      const res = checkSkillUpdate('2026_05_16-C5E7870', '2026_05_16-c5e78707');
      assert.equal(res.warn, false);
    });

    it('does not treat different dates as same commit even if SHAs prefix-match', () => {
      const fixedNow = Date.UTC(2026, 8, 20);
      const res = checkSkillUpdate('2026_01_01-c5e7870', '2026_09_09-c5e78707', fixedNow);
      assert.equal(res.warn, true);
    });

    it('does not falsely match short non-SHA suffixes', () => {
      const fixedNow = Date.UTC(2026, 8, 20); // Sep 20
      const res = checkSkillUpdate('2026_01_01-1', '2026_09_09-12345678', fixedNow);
      assert.equal(res.warn, true);
    });

    it('does not warn if caller version is newer than latest version (inverted warning fix)', () => {
      // Lea's scenario: caller updated to 2026_08_31, but CLI package was on 2026_05_16
      const fixedNow = Date.UTC(2026, 8, 6); // Sep 6, 2026
      const res = checkSkillUpdate('2026_08_31-6ba3cecd', '2026_05_16-c5e78707', fixedNow);
      assert.equal(res.warn, false);
    });

    it('does not warn if caller and latest version have the same date', () => {
      const fixedNow = Date.UTC(2026, 8, 15);
      const res = checkSkillUpdate('2026_08_31-11111111', '2026_08_31-22222222', fixedNow);
      assert.equal(res.warn, false);
    });

    it('respects 5-day grace period including time-of-day at 5.5 days', () => {
      // Caller released on Sept 5 at 00:00 UTC
      const callerVersion = '2026_09_05-11111111';
      const latestVersion = '2026_09_10-22222222';
      // Checked on Sept 10 at 12:00 PM UTC (5.5 days after caller)
      const noonDay5 = Date.UTC(2026, 8, 10, 12, 0, 0);
      const res = checkSkillUpdate(callerVersion, latestVersion, noonDay5);
      assert.equal(res.warn, false);
    });

    it('warns when caller is older than 5 days (e.g. 6 days old)', () => {
      const callerVersion = '2026_09_04-11111111';
      const latestVersion = '2026_09_10-22222222';
      const day6 = Date.UTC(2026, 8, 10, 1, 0, 0); // 6.04 days
      const res = checkSkillUpdate(callerVersion, latestVersion, day6);
      assert.equal(res.warn, true);
      assert.equal(res.critical, false);
      assert.match(res.warningMessage || '', /Warning: a new SKILL\.md is available/);
    });

    it('emits critical warning when caller is 60+ days old', () => {
      const fixedNow = Date.UTC(2026, 8, 20); // Sep 20
      const callerVersion = '2026_05_16-11111111'; // May 16 (>120 days old)
      const latestVersion = '2026_09_15-22222222'; // Sep 15
      const res = checkSkillUpdate(callerVersion, latestVersion, fixedNow);
      assert.equal(res.warn, true);
      assert.equal(res.critical, true);
      assert.match(res.criticalMessage || '', /PROBLEM DETECTED: The modern-web-guidance skill is very out-of-date/);
    });
  });
});
