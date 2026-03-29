---
name: intl-locale-info
description: Retrieve comprehensive locale-specific conventions including calendar systems, text direction, and week layout rules.
web-feature-ids:
  - intl-locale-info
sources:
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getCalendars
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getCollations
  - https://tc39.es/ecma402/#locale-objects
---

The `Intl.Locale` info methods provide access to locale-dependent metadata natively within the browser, eliminating the need to bundle large libraries or dictionaries to determine how to format calendars, time inputs, or text flow. By querying methods like `getCalendars()`, `getWeekInfo()`, or `getTextInfo()`, developers can automatically adapt their UI layouts, date pickers, and input components to match the user's regional expectations.

### Usage

**1. Verify API support** (MANDATORY)
Ensure the required methods exist on the prototype before invoking them, to prevent runtime exceptions in older environments.

```javascript
// Feature detection for Intl.Locale info methods
// Checking the prototype ensures we can safely call these methods on instances
const isLocaleInfoSupported = 'getCalendars' in Intl.Locale.prototype;
```

**2. Instantiate an Intl.Locale object**
Create a new locale instance representing the user's preferred language tag.

```javascript
// Instantiates a locale for Egyptian Arabic
const locale = new Intl.Locale('ar-EG');
```

**3. Retrieve locale metadata**
Call the various getters to access arrays or objects defining localized behaviors and conventions.

```javascript
if (isLocaleInfoSupported) {
  // Returns an array of supported calendars (e.g., ['gregory', 'coptic', 'islamic'])
  const calendars = locale.getCalendars();

  // Returns an object containing the text direction: { direction: 'rtl' }
  const textInfo = locale.getTextInfo();

  // Returns an object with firstDay (integer), weekend (array), and minimalDays (integer)
  const weekInfo = locale.getWeekInfo();
  
  // Use the extracted metadata to adjust UI presentation dynamically
  document.body.dir = textInfo.direction;
}
```

### Fallback strategies

{{ BASELINE_STATUS("intl-locale-info") }}

For unsupported environments, you must implement a hardcoded mapping or bundle an external library (like small localized datasets) that maps language codes to default text directions, first day of the week, and numbering systems. A minimal fallback might default to Gregorian calendars, LTR text direction, and standard weekend mappings for common locales while gracefully ignoring edge cases that the native API would handle automatically.
