---
base_app: daily-grind
---

- Add a script tag at the bottom that calculates how long until a user's credit card expires (set it to December 2027). MANDATORY: It must feature-detect and conditionally load the `Temporal` polyfill only if native support is absent, manually assign the loaded polyfill to `globalThis.Temporal`, use `Temporal.PlainYearMonth` for modeling the card's expiry month, and MUST NOT use the legacy `Date` object for representing partial time concepts.
- We want to give out a free cold brew on the customer's birthday. Write some code to check if today is October 31st. MANDATORY: It must feature-detect and conditionally load the `Temporal` polyfill only if native support is absent, manually assign it to `globalThis.Temporal`, use `Temporal.PlainMonthDay` for modeling the partial birthday, and MUST NOT use the legacy `Date` object for representing partial time concepts.
- Can you build a store hours checker? Set our open time to 08:00:00. MANDATORY: It must feature-detect and conditionally load the `Temporal` polyfill only if native support is absent, manually assign it to `globalThis.Temporal`, use `Temporal.PlainTime` for modeling the partial time concept, and MUST NOT use the legacy `Date` object.
