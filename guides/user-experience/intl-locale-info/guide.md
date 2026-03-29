---
name: intl-locale-info
description: Retrieve supplementary localization data like calendars, time zones, and week info directly from an Intl.Locale object.
web-feature-ids:
  - intl-locale-info
sources:
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getCalendars
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getCollations
  - https://tc39.es/ecma402/#locale-objects
---

The `Intl.Locale` info API provides getter methods (like `getCalendars()`, `getTextInfo()`, and `getWeekInfo()`) to extract supplemental, locale-specific data such as numbering systems, writing direction, and first day of the week. This eliminates the need to ship large, custom localization libraries to determine culturally appropriate formatting rules. 

### Implementation

1. **Feature detection**
Check for the existence of one of the new getter methods on the `Intl.Locale.prototype` before using it.

```javascript
// Ensure the environment supports the Intl.Locale info getters before execution
if (typeof Intl !== 'undefined' && 'getCalendars' in Intl.Locale.prototype) {
  // Safe to use Intl.Locale info getters
}
```

2. **Retrieve locale info (MANDATORY)**
Instantiate an `Intl.Locale` object and call the necessary getter methods. 

```javascript
// Create a Locale object for Arabic as used in Egypt to inspect its defaults
const locale = new Intl.Locale('ar-EG');

// Retrieve calendar systems to properly configure date pickers
// Returns an array of supported calendars, ordered by preference
const calendars = locale.getCalendars(); 

// Retrieve text direction to adjust layout (RTL vs LTR)
// Returns an object like { direction: "rtl" }
const textInfo = locale.getTextInfo();

// Retrieve week data to correctly render calendar UI grids
// Returns an object with firstDay, weekend, and minimalDays
const weekInfo = locale.getWeekInfo();
```

3. **Handle overridden configurations**
When a locale is created with an explicit configuration, the getter returns an array containing only that override.

```javascript
// Explicitly request the Japanese calendar via the configuration object
const jpLocale = new Intl.Locale('ja-JP', { calendar: 'japanese' });

// Because the calendar was overridden, this guarantees a single-item array ["japanese"]
// rather than all commonly used calendars in Japan
const jpCalendars = jpLocale.getCalendars();
```

### Fallback strategies

{{ BASELINE_STATUS("intl-locale-info") }}

If the API is unsupported, you must rely on hardcoded fallback maps or ship a lightweight localization payload for the user's specific locale. Since properties like `firstDay` or `direction` are statically tied to languages and regions, a switch statement or dictionary can substitute missing functionality for your supported locales. Avoid shipping a full ICU CLDR dataset unless required.

```javascript
function getLocaleDirection(localeStr) {
  if (typeof Intl !== 'undefined' && 'getTextInfo' in Intl.Locale.prototype) {
    return new Intl.Locale(localeStr).getTextInfo().direction;
  }
  
  // Fallback: Check against a known list of RTL language codes
  const rtlLangs = /^(ar|he|fa|ur)/i;
  return rtlLangs.test(localeStr) ? 'rtl' : 'ltr';
}
```
