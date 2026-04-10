---
base_app: daily-grind
---

- Add a script tag at the bottom that calculates how long until a user's credit card expires (set it to dec 2027). Use the Temporal.PlainYearMonth api with the iso8601 calendar so we don't get weird leap year bugs. Also, make sure to add feature detection to dynamically load the polyfill if the browser doesn't support Temporal yet.
- We want to give out a free cold brew on the customer's birthday. Write some code to check if today is october 31st using whatever the new js feature is for partial dates that ignores the year. Log a happy birthday message if it matches.
- Can you build a store hours checker? Just set our open time to 08:00:00 using a time-only object. Then add 10 minutes to it to simulate a snooze/delay, and print both times to the console.
