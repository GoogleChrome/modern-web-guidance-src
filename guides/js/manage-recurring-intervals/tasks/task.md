---
base_app: daily-grind
---
- Add a coffee subscription delivery planner section to the main container so users can calculate when their next recurring delivery will arrive. Create a card with a start date input (`#startDateInput`), inputs for years and months to add (`#yearsInput` and `#monthsInput`), a dropdown (`#overflowSelect` with options `constrain` and `reject`) for handling month-end edge cases (such as adding 1 month to Jan 31), and an output element (`#resultDate`) that updates automatically when any input changes and displays a clear error message if an invalid date is rejected.
- make the delivery planner look super modern and match the dark brown and warm cream aesthetic of the rest of our coffee website. maybe add a few quick preset buttons for common coffee subscription schedules, like "every month" or "every year", that automatically pre-fill the inputs and calculate the next shipment date.
