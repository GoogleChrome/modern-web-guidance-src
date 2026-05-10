---
base_app: daily-grind
---
- update the `.card` elements to fade in from opacity 0 over 0.5s when they are first added to the screen. use the modern css feature for defining initial before-render states, but make sure to wrap those specific styles in a feature query that explicitly checks if the browser supports that exact type of css rule.
- let's update the `.grid` to use container-based sizing so the layout responds to the parent width. please apply the new responsive styles conditionally by checking first if the browser actually recognizes that specific structural css rule.
- wire up smooth morphing animations when navigating between pages. wrap the new transition styles in a feature check that verifies the browser understands the modern block-level rule for it.