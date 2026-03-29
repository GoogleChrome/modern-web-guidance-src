## Must pass
- Must check for `Intl.Locale.prototype` getter methods (e.g., `'getCalendars' in Intl.Locale.prototype`) before calling them.
- Must instantiate a new `Intl.Locale` object to access locale info.
- Must invoke at least one of the `Intl.Locale` info getter methods (`getCalendars`, `getTextInfo`, `getWeekInfo`, `getCollations`, `getHourCycles`, `getNumberingSystems`, `getTimeZones`).
- Must handle the return types correctly (e.g., arrays for calendars, objects for text and week info).
- Must provide a functional fallback or degradation path if the getters are unsupported.

## Must fail
- Must fail if locale data is queried via deprecated `Intl.Locale` accessor properties (e.g., `locale.calendars` instead of `locale.getCalendars()`).
- Must fail if it ships a large external timezone or locale data library (like `moment-timezone` or full `date-fns` locale sets) to retrieve basic locale defaults like calendar or direction, instead of using the native API.
- Must fail if it attempts to call the getters statically on the constructor (e.g., `Intl.Locale.getCalendars()`) instead of on an instance.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames.
- Assert API usage patterns and outcomes, not specific code structure.
- Assert that feature detection happens before using the specific methods on `Intl.Locale`.
- Assert that the correct instance methods are used instead of legacy properties.