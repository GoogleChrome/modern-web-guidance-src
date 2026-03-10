# Research Notes - Cross-Document View Transitions

## Key Mechanics
- `@view-transition { navigation: auto; }` opts-in same-origin navigations.
- `pageswap` and `pagereveal` events allow customization before/after transition snapshots.
- `view-transition-name` is used to match elements across pages for shared transitions.
- `types` (e.g., `@view-transition { types: slide; }`) allow categorized animations.

## Potential Use Cases
1. **Multi-Page App (MPA) Seamless Navigation**
   - *Description*: Provide smooth fade/slide transitions between pages (e.g., Blog List -> Blog Post) preserving visual continuity without SPA routing.
2. **Shared Element Morphing**
   - *Description*: Animate a specific element (like a product thumbnail) into its expanded form on the next page (product details), creating a spatial illusion.
3. **Directional Transitions (Back/Forward)**
   - *Description*: Apply different animations (e.g., slide left vs slide right) depending on whether the user is navigating forward or backward.
4. **Viewport-Centric Reveals (e.g., Circular Reveal)**
   - *Description*: Trigger an animation from the click location on the outgoing page to reveal the incoming page.
