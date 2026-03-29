---
base_app: daily-grind
grader: intl-locale-info
---
add a script to the html that sets the document direction (ltr or rtl) based on the user's navigator language. use the intl.locale gettextinfo api to get the direction, and include a regex fallback for common rtl languages like arabic or hebrew just in case the browser doesn't support the getter yet.
