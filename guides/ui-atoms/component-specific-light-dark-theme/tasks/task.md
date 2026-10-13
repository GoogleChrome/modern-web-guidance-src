---
base_app: daily-grind
---
- Add light and dark theme support to the site. Give all product cards a shared `themed-card` class, force the Dark Roast Espresso card to always stay in dark mode independently of the page's color scheme, and allow any `themed-card` to be overridden into light mode by adding a `force-light` class.
- implement a dark-themed feature section for artisanal roasting that has its own background color and stays dark regardless of the user's system theme, making sure the text color inside it adapts properly without inheritance bugs.
- make the cards look good when we force them into dark or light styles, and ensure form elements inside them also render correctly.
