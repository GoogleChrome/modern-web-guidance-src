## Must pass
- Code checks for feature support by checking if a method like `getCalendars` exists on `Intl.Locale.prototype` before executing.
- Application successfully instantiates an `Intl.Locale` object.
- Application invokes one or more Intl.Locale getter methods (e.g., `getCalendars()`, `getTextInfo()`, `getWeekInfo()`) to retrieve metadata.
- Application utilizes the returned metadata to dynamically control rendering logic or data formatting (e.g., dynamically updating the document layout direction, week start day, or selecting the proper calendar).

## Must fail
- Maintaining large, hardcoded lookup maps of specific language tags to weekend days, calendar systems, or text layout directions in modern environments.
- Polling for the presence of the API continuously.
- Accessing older properties (like `locale.calendar` or `locale.hourCycle`) to fetch supported collections, instead of calling the new info getter methods (like `locale.getCalendars()`).

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames.
- Assert API usage patterns and outcomes, not specific code structure.
- Tests should focus purely on verifying that the native Intl.Locale getters are correctly utilized or appropriately feature-detected.
