import { test } from 'node:test';
import assert from 'node:assert';
import { parseJobDate, parseJobDateInfo, formatJobDate, getJobDayKey } from './utils.js';
function withTimeZone(tz: string, fn: () => void) {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    try { fn(); } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; }
}
test('parseJobDate builds UTC instants for testId-derived and zoneless timestamps', () => {
    assert.strictEqual(parseJobDate(undefined, 'nightly-2026-10-09_07-00-02-claude_code')?.toISOString(), '2026-10-09T07:00:02.000Z');
    assert.strictEqual(parseJobDate('2026-10-09', 'nightly-2026-10-09_18-30-00-codex_cli')?.toISOString(), '2026-10-09T18:30:00.000Z');
    assert.strictEqual(parseJobDate('2026-10-09T00:00:00Z', 'nightly-2026-10-09_07-00-02-x')?.toISOString(), '2026-10-09T07:00:02.000Z');
    assert.strictEqual(parseJobDate('2026-10-09T14:20:00.5')?.toISOString(), '2026-10-09T14:20:00.500Z');
    assert.strictEqual(parseJobDate('2026-10-09T14:20:00+02:00')?.toISOString(), '2026-10-09T12:20:00.000Z');
    assert.strictEqual(parseJobDate('not-a-date', 'adhoc-2026-10-09_05-06-07')?.toISOString(), '2026-10-09T05:06:07.000Z');
    assert.strictEqual(parseJobDate(null, 'nightly-2026-10-09-claude_code')?.toISOString(), '2026-10-09T00:00:00.000Z');
    assert.strictEqual(parseJobDate('2026-13-40'), null);
    assert.strictEqual(parseJobDate('', 'no-date'), null);
});
test('date-only values are independent of the viewer time zone', () => {
    for (const tz of ['America/Los_Angeles', 'UTC', 'Asia/Tokyo']) {
        withTimeZone(tz, () => {
            const info = parseJobDateInfo('2026-10-09');
            assert.ok(info);
            assert.strictEqual(info.dateOnly, true);
            assert.strictEqual(info.date.toISOString(), '2026-10-09T00:00:00.000Z', tz);
            assert.strictEqual(getJobDayKey(info), '2026-10-09', tz);
            assert.strictEqual(getJobDayKey('2026-10-09'), '2026-10-09', tz);
            assert.strictEqual(formatJobDate(info, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), 'Oct 9, 2026', tz);
        });
    }
});
test('real instants bucket into the viewer calendar day, consistently for key and label', () => {
    const testId = 'nightly-2026-11-09_07-00-00-claude_code';
    withTimeZone('America/Los_Angeles', () => {
        const info = parseJobDateInfo(undefined, testId);
        assert.ok(info);
        assert.strictEqual(getJobDayKey(info), '2026-11-08');
        assert.strictEqual(formatJobDate(info, { month: 'short', day: 'numeric', year: 'numeric' }), 'Nov 8, 2026');
    });
    withTimeZone('Europe/Berlin', () => {
        const info = parseJobDateInfo(undefined, testId);
        assert.ok(info);
        assert.strictEqual(getJobDayKey(info), '2026-11-09');
        assert.strictEqual(formatJobDate(info, { month: 'short', day: 'numeric', year: 'numeric' }), 'Nov 9, 2026');
    });
});
test('a genuine UTC-midnight instant is a real time, not a date-only value', () => {
    withTimeZone('America/Los_Angeles', () => {
        const info = parseJobDateInfo('2026-10-09T00:00:00Z');
        assert.ok(info);
        assert.strictEqual(info.dateOnly, false);
        assert.strictEqual(getJobDayKey(info), '2026-10-08');
        assert.strictEqual(formatJobDate(info, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), 'Oct 8, 2026, 5:00 PM');
        assert.strictEqual(formatJobDate('2026-10-09T00:00:00Z'), 'Oct 8, 2026, 5:00 PM');
        assert.strictEqual(parseJobDateInfo('2026-10-09T00:00:00Z', 'nightly-2026-10-09_00-00-00-x')?.dateOnly, false);
        const dateOnly = parseJobDateInfo('2026-10-09');
        assert.ok(dateOnly);
        assert.strictEqual(dateOnly.dateOnly, true);
        assert.strictEqual(getJobDayKey(dateOnly), '2026-10-09');
        assert.strictEqual(formatJobDate(dateOnly, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), 'Oct 9, 2026');
        assert.strictEqual(formatJobDate('2026-10-09'), 'Oct 9, 2026');
    });
});
test('parseJobDateInfo reports date-only-ness explicitly', () => {
    assert.deepStrictEqual(parseJobDateInfo('2026-10-09'), { date: new Date('2026-10-09T00:00:00.000Z'), dateOnly: true });
    assert.strictEqual(parseJobDateInfo('2026-10-09T00:00')?.dateOnly, false);
    assert.strictEqual(parseJobDateInfo('2026-10-09T00:00:00.000Z')?.dateOnly, false);
    assert.strictEqual(parseJobDateInfo(null, 'nightly-2026-10-09-claude_code')?.dateOnly, true);
    assert.strictEqual(parseJobDateInfo('2026-10-09', 'nightly-2026-10-09_18-30-00-codex_cli')?.dateOnly, false);
    assert.strictEqual(parseJobDateInfo('garbage'), null);
});
test('formatJobDate(dateLike, testId) resolves from the testId and defaults to date + time', () => {
    withTimeZone('America/Los_Angeles', () => {
        assert.strictEqual(formatJobDate(undefined, 'nightly-2026-11-09_07-00-02-claude_code'), 'Nov 8, 2026, 11:00 PM');
        assert.strictEqual(formatJobDate('2026-11-09', 'nightly-2026-11-09_07-00-02-claude_code'), 'Nov 8, 2026, 11:00 PM');
        assert.strictEqual(formatJobDate(null, 'nightly-2026-11-09-claude_code'), 'Nov 9, 2026');
        assert.strictEqual(formatJobDate(null, 'example-result'), '-');
        assert.strictEqual(formatJobDate(new Date(NaN)), '-');
    });
});
