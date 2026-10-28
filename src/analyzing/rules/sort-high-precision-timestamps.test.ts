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
  await t.test('flags .sort() and .toSorted() comparators calling Date.parse() or new Date() on timestamp properties', () => {
    const code = `
      const sortedLogs = logs.sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
      );

      const orderedEvents = events.toSorted(
        (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
      );

      const byCreated = items.sort((a, b) => {
        return +new Date(a.createdAt) - +new Date(b.createdAt);
      });
    `;
    const matches = runMatcher(code);
    assert.equal(matches.length, 3);
    assert.equal(matches[0]?.line, 2);
    assert.equal(matches[1]?.line, 6);
    assert.equal(matches[2]?.line, 10);
  });

  await t.test('exempts calendar date sorting (birthDate, dueDate, date, released) and Temporal.Instant.compare()', () => {
    const calendarCode = `
      episodes.sort((a, b) => Date.parse(b.released) - Date.parse(a.released));
      tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      users.sort((a, b) => new Date(a.birthDate).getTime() - new Date(b.birthDate).getTime());
      posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      rawDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    `;
    assert.equal(runMatcher(calendarCode).length, 0);

    const temporalCode = `
      const ordered = events.toSorted((a, b) =>
        Temporal.Instant.compare(
          Temporal.Instant.from(a.timestamp),
          Temporal.Instant.from(b.timestamp),
        ),
      );
    `;
    assert.equal(runMatcher(temporalCode).length, 0);
  });
});
