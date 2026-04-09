## Must pass
- The implementation constructs an `Intl.Locale` instance using the target locale
- The implementation retrieves week information by calling `getWeekInfo()` on the `Intl.Locale` instance (or accessing the `weekInfo` property)
- The calendar dynamically determines the first day of the week using the `firstDay` property from the locale's week information
- The calendar dynamically determines which days are highlighted as weekends using the `weekend` array/property from the locale's week information

## Must fail
- The implementation hardcodes the start of the week for all users (e.g., always assuming Sunday or Monday)
- The implementation hardcodes the weekend days (e.g., always assuming Saturday and Sunday are the weekend)
- The implementation uses external libraries (like `moment` or `date-fns`), custom lookup objects, or switch statements to map locales to their respective first days and weekends instead of using the native `Intl` API

## App-agnostic rules
- Do not assert specific variable names, function names, or filenames
- Assert API usage patterns and outcomes, not specific code structure
- Do not enforce a specific UI framework, DOM structure, or rendering approach for the calendar widget
- Do not mandate how the application obtains the user's locale (e.g., `navigator.language`, user settings, or hardcoded for testing) as long as it is passed to the `Intl.Locale` API