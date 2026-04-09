## Must pass
- Must use the `Intl.Locale` API to determine the text directionality of the specified language
- Must retrieve the direction property (e.g., via `textInfo.direction` or `getTextInfo().direction`) from the `Intl.Locale` object
- Must apply or output the determined text direction dynamically based on the input locale

## Must fail
- Must not use hardcoded arrays or sets of language codes to determine if a language is RTL or LTR
- Must not use regular expressions matching specific language codes to infer directionality
- Must not rely on third-party libraries to determine text direction

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Do not require a specific UI framework or DOM manipulation method for applying the direction