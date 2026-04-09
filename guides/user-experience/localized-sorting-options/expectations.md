## Must pass
- Must instantiate an `Intl.Locale` object for the target locale.
- Must retrieve available or preferred collations using the Intl.Locale API (e.g., `getCollations()` method or `collations` property).
- Must utilize the retrieved collation options to inform the sorting logic, such as configuring an `Intl.Collator` instance.

## Must fail
- Hardcoding available sorting algorithms or collation types for specific languages or regions.
- Relying solely on default string comparison without applying culturally appropriate collation rules.
- Providing a predefined list of sorting options without querying the `Intl.Locale` API for the locale's actual supported collations.

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Do not mandate a specific UI implementation (e.g., dropdowns vs radio buttons) for selecting the sorting option, focusing instead on the underlying data retrieval.