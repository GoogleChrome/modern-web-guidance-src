import assert from 'node:assert/strict';
import test from 'node:test';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import { sortHighPrecisionTimestampsMatcher } from './sort-high-precision-timestamps.ts';

function runMatcher(code: string, filePath = 'timeline.ts') {
  return withVirtualSourceFile(filePath, code, (sourceFile) =>
    sortHighPrecisionTimestampsMatcher.matchFile(sourceFile, {
      filePath,
      fileContent: code,
    }),
  );
}

void test('sort-high-precision-timestamps JS matcher', async (t) => {
  await t.test('flags .sort() and .toSorted() comparators in sub-millisecond, trace, or log-event contexts', () => {
    const code = `
      // CloudWatch / high-precision trace log sorting
      const sortedLogs = logs.sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
      );

      const orderedSpans = traceSpans.toSorted(
        (left, right) => new Date(right.traceTime).getTime() - new Date(left.traceTime).getTime(),
      );

      const nanoOrdered = items.sort((a, b) => {
        return +new Date(a.nanoTimestamp) - +new Date(b.nanoTimestamp);
      });
    `;
    const matches = runMatcher(code);
    assert.equal(matches.length, 3);
    assert.equal(matches[0]?.line, 3);
    assert.equal(matches[1]?.line, 7);
    assert.equal(matches[2]?.line, 11);
  });

  await t.test('exempts ordinary millisecond CRUD timestamps (createdAt, updatedAt), calendar dates, downstream subtraction, and Temporal.Instant.compare()', () => {
    const crudAndCalendarCode = `
      snippets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      records.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
      messages.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      episodes.sort((a, b) => Date.parse(b.released) - Date.parse(a.released));
      tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      users.sort((a, b) => new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime());
      posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    `;
    assert.equal(runMatcher(crudAndCalendarCode).length, 0);

    const downstreamArithmeticCode = `
      function processLogs(logs: Array<{ timestamp: number }>) {
        logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const delta = logs[1]!.timestamp - logs[0]!.timestamp;
        return delta;
      }
    `;
    assert.equal(runMatcher(downstreamArithmeticCode).length, 0);

    const temporalCode = `
      const ordered = traceEvents.toSorted((a, b) =>
        Temporal.Instant.compare(
          Temporal.Instant.from(a.timestamp),
          Temporal.Instant.from(b.timestamp),
        ),
      );
    `;
    assert.equal(runMatcher(temporalCode).length, 0);
  });
});
