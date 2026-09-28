---
name: custom-list-markers
description: Create a list with custom markers, including custom icons, steps, or interactive markers such as checkboxes
draft: stub
web-feature-ids:
  - marker
  - list-style
  - subgrid
  - counter-style
  - symbols-function
---

# Custom List Markers

## Notes for guide authors

This is meant to function as the first stop for any use case involving a list with custom markers of any sort, including interactive ones.

- `list-style: <string>` for very basic customization
- `::marker`, but note caveats and switch to `::before` otherwise
- `--icon-marker` once the icons guide is written (guide ref to `icons`)
- `.marker` for actual HTML (e.g. checkboxes)
- subgrid for layout, but note that this can backfire without a content wrapper
- Note that a content wrapper is not always an option (e.g. Markdown lists) so need to cover other layouts too
- Cover variations such as marker backgrounds and connected markers, such as those used in steps lists

## Relationship to other guides

- Once this is done, `checkbox-group` can refer to it for layout
- Once `icons` is done, this can refer to it for icon markers
