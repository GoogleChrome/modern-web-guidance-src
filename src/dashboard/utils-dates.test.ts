import { test } from 'node:test';
import assert from 'node:assert';
import { parseSuiteDate, parseSuiteDateInfo, formatSuiteDate, getSuiteDayKey, isDateOnlySuiteDate, toSuiteDateString } from './utils.js';
function withTimeZone(tz: string, fn: () => void) {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    try { fn(); } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; }
}
test('parseSuiteDate builds UTC instants for testId-derived and zoneless timestamps', () => {
    assert.strictEqual(parseSuiteDate(undefined, 'nightly-2026-10-09_07-00-02-claude_code')?.toISOString(), '2026-10-09T07:00:02.000Z');
    assert.strictEqual(parseSuiteDate('2026-10-09', 'nightly-2026-10-09_18-30-00-codex_cli')?.toISOString(), '2026-10-09T18:30:00.000Z');
    assert.strictEqual(parseSuiteDate('2026-10-09T00:00:00Z', 'nightly-2026-10-09_07-00-02-x')?.toISOString(), '2026-10-09T07:00:02.000Z');
    assert.strictEqual(parseSuiteDate('2026-10-09T14:20:00.5')?.toISOString(), '2026-10-09T14:20:00.500Z');
    assert.strictEqual(parseSuiteDate('2026-10-09T14:20:00+02:00')?.toISOString(), '2026-10-09T12:20:00.000Z');
    assert.strictEqual(parseSuiteDate('not-a-date', 'adhoc-2026-10-09_05-06-07')?.toISOString(), '2026-10-09T05:06:07.000Z');
    assert.strictEqual(parseSuiteDate(null, 'nightly-2026-10-09-claude_code')?.toISOString(), '2026-10-09T00:00:00.000Z');
    assert.strictEqual(parseSuiteDate('2026-13-40'), null);
    assert.strictEqual(parseSuiteDate('', 'no-date'), null);
});
test('date-only values are independent of the viewer time zone', () => {
    for (const tz of ['America/Los_Angeles', 'UTC', 'Asia/Tokyo']) {
        withTimeZone(tz, () => {
            const d = parseSuiteDate('2026-10-09');
            assert.ok(d);
            assert.ok(isDateOnlySuiteDate(d));
            assert.strictEqual(d.toISOString(), '2026-10-09T00:00:00.000Z', tz);
            assert.strictEqual(getSuiteDayKey(d), '2026-10-09', tz);
            assert.strictEqual(formatSuiteDate(d, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), 'Oct 9, 2026', tz);
        });
    }
});
test('real instants bucket into the viewer calendar day, consistently for key and label', () => {
    const testId = 'nightly-2026-11-09_07-00-00-claude_code';
    withTimeZone('America/Los_Angeles', () => {
        const d = parseSuiteDate(undefined, testId);
        assert.ok(d);
        assert.strictEqual(getSuiteDayKey(d), '2026-11-08');
        assert.strictEqual(formatSuiteDate(d, { month: 'short', day: 'numeric', year: 'numeric' }), 'Nov 8, 2026');
    });
    withTimeZone('Europe/Berlin', () => {
        const d = parseSuiteDate(undefined, testId);
        assert.ok(d);
        assert.strictEqual(getSuiteDayKey(d), '2026-11-09');
        assert.strictEqual(formatSuiteDate(d, { month: 'short', day: 'numeric', year: 'numeric' }), 'Nov 9, 2026');
    });
});
test('a genuine UTC-midnight instant is a real time, not a date-only value', () => {
    withTimeZone('America/Los_Angeles', () => {
        const d = parseSuiteDate('2026-10-09T00:00:00Z');
        assert.ok(d);
        assert.strictEqual(isDateOnlySuiteDate(d), false);
        assert.strictEqual(getSuiteDayKey(d), '2026-10-08');
        assert.strictEqual(formatSuiteDate(d, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), 'Oct 8, 2026, 5:00 PM');
        assert.strictEqual(formatSuiteDate('2026-10-09T00:00:00Z'), 'Oct 8, 2026, 5:00 PM');
        assert.strictEqual(parseSuiteDateInfo('2026-10-09T00:00:00Z', 'nightly-2026-10-09_00-00-00-x')?.dateOnly, false);
        const dateOnly = parseSuiteDate('2026-10-09');
        assert.ok(dateOnly);
        assert.strictEqual(isDateOnlySuiteDate(dateOnly), true);
        assert.strictEqual(getSuiteDayKey(dateOnly), '2026-10-09');
        assert.strictEqual(formatSuiteDate(dateOnly, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), 'Oct 9, 2026');
        assert.strictEqual(formatSuiteDate('2026-10-09'), 'Oct 9, 2026');
    });
});
test('parseSuiteDateInfo reports date-only-ness explicitly', () => {
    assert.deepStrictEqual(parseSuiteDateInfo('2026-10-09'), { date: new Date('2026-10-09T00:00:00.000Z'), dateOnly: true });
    assert.strictEqual(parseSuiteDateInfo('2026-10-09T00:00')?.dateOnly, false);
    assert.strictEqual(parseSuiteDateInfo('2026-10-09T00:00:00.000Z')?.dateOnly, false);
    assert.strictEqual(parseSuiteDateInfo(null, 'nightly-2026-10-09-claude_code')?.dateOnly, true);
    assert.strictEqual(parseSuiteDateInfo('2026-10-09', 'nightly-2026-10-09_18-30-00-codex_cli')?.dateOnly, false);
    assert.strictEqual(parseSuiteDateInfo('garbage'), null);
    const d = parseSuiteDate('2026-10-09');
    assert.ok(d);
    assert.strictEqual(isDateOnlySuiteDate(new Date(d)), false);
    assert.strictEqual(toSuiteDateString(d), '2026-10-09');
    const reparsed = parseSuiteDate(toSuiteDateString(d));
    assert.ok(reparsed);
    assert.strictEqual(isDateOnlySuiteDate(reparsed), true);
    const instant = parseSuiteDate('2026-10-09T00:00:00Z');
    assert.ok(instant);
    assert.strictEqual(toSuiteDateString(instant), '2026-10-09T00:00:00.000Z');
});
test('formatSuiteDate(dateLike, testId) resolves from the testId and defaults to date + time', () => {
    withTimeZone('America/Los_Angeles', () => {
        assert.strictEqual(formatSuiteDate(undefined, 'nightly-2026-11-09_07-00-02-claude_code'), 'Nov 8, 2026, 11:00 PM');
        assert.strictEqual(formatSuiteDate('2026-11-09', 'nightly-2026-11-09_07-00-02-claude_code'), 'Nov 8, 2026, 11:00 PM');
        assert.strictEqual(formatSuiteDate(null, 'nightly-2026-11-09-claude_code'), 'Nov 9, 2026');
        assert.strictEqual(formatSuiteDate(null, 'example-result'), '-');
        assert.strictEqual(formatSuiteDate(new Date(NaN)), '-');
    });
});
