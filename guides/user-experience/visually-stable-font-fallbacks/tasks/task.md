---
base_app: daily-grind
---
- i'm seeing layout shifts when my custom web font loads and replaces the fallback. update it to make the text size more stable during the swap.
- prevent cls caused by font loading by normalizing the x-height of my fallback fonts
- make sure the text stays readable even if the web font fails to load and it falls back to a different font with smaller lowercase letters
