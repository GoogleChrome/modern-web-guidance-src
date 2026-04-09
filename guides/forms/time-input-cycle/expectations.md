## Must pass
- Must instantiate an `Intl.Locale` object with the target locale.
- Must access the `hourCycle` or `hourCycles` property on the `Intl.Locale` instance to determine the preferred hour cycle.
- Must configure the time input form or component to use either a 12-hour or 24-hour format based on the value retrieved from the locale's hour cycle (e.g., handling 'h11', 'h12' vs 'h23', 'h24').

## Must fail
- Must not use a hardcoded mapping or lookup table of locales to determine 12-hour or 24-hour preferences.
- Must not infer the hour cycle preference by formatting a date using `Intl.DateTimeFormat` or `toLocaleTimeString` and parsing the resulting string for 'AM' or 'PM'.
- Must not rely on third-party internationalization or date libraries to extract the hour cycle preference when native APIs can provide it.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Assertions should apply regardless of the specific UI framework or component library used for the time input form