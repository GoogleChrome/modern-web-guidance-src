# CSS Subgrid: A Comprehensive Academic Report on Nested Grid Architectures

**Key Points:**
*   **Fundamental Shift in Layout Capabilities:** Research suggests that the introduction of CSS Subgrid addresses one of the most persistent challenges in modern web design: the inability of deeply nested child elements to seamlessly align with a parent's grid layout structure [cite: 1, 2]. 
*   **Semantic Preservation over Hacks:** Evidence leans heavily toward Subgrid as the architecturally superior alternative to historically problematic workarounds, such as `display: contents`, which has been known to introduce severe accessibility regressions by inadvertently removing elements from the accessibility tree [cite: 3, 4].
*   **Modern Browser Baseline:** It is well established that Subgrid has reached broad consensus and support across all major browser engines (Chrome, Firefox, Safari, Edge) as of late 2023, making it a viable and safe standard for enterprise-grade production environments [cite: 1, 2].
*   **Specific Technical Constraints:** While Subgrid dramatically simplifies 2D alignment, developers must navigate a specific set of architectural constraints; most notably, a subgrid cannot generate implicit grid tracks within its subgridded dimension, and it fundamentally relies on explicit spanning declarations defined by its parent grid [cite: 1, 5].

**The Challenge of Nested Layouts**
For years, web developers operating under the CSS Grid Layout Module Level 1 constraints faced a distinct limitation: only direct children of a grid container could participate in the grid's track sizing and placement algorithms. This forced developers to either flatten their HTML structures—sacrificing semantic hierarchy—or accept misaligned nested components, such as unequal card headers and footers across a responsive row.

**The Subgrid Paradigm**
The CSS Subgrid feature introduces a mechanism by which a grid container can explicitly defer the definition of its rows and columns to its parent grid container. By allowing a child element to inherit the precise track sizing, line names, and gaps of its ancestor, Subgrid bridges the gap between semantic HTML organization and strict two-dimensional visual design, representing a critical evolution in the CSS specification.

***

## Overview of CSS Subgrid

The CSS Grid Layout Module fundamentally changed the trajectory of web interface design by providing a native, highly optimized, two-dimensional layout system. However, its initial release in 2017 possessed a significant architectural limitation: only the direct children of a grid container were placed onto the grid layout [cite: 6, 7]. Any subsequent grandchildren or deeply nested elements were completely isolated from the primary grid's track sizing and line placement calculations [cite: 7, 8]. This structural isolation meant that if a developer wanted internal elements of independent sibling containers (e.g., the title, image, and footer of separate article cards) to align with one another across a row, they had to rely on brittle minimum height declarations or problematic CSS properties like `display: contents` [cite: 9, 10].

To resolve this limitation, the CSS Working Group deferred the solution to the **CSS Grid Layout Module Level 2** specification to allow implementors sufficient time to address its inherent complexities [cite: 5, 11]. This deferment culminated in the creation of the `subgrid` keyword. 

A subgrid acts essentially as an extension of the existing nested grid paradigm. When a developer applies `display: grid` to an element, it establishes an independent grid formatting context. However, if the developer assigns the `subgrid` keyword to the `grid-template-columns` and/or `grid-template-rows` properties of that element, the nested grid stops generating its own independent tracks [cite: 5, 12]. Instead, it defers to the track sizing, gaps, and line names of its parent grid for the portion of the grid it occupies [cite: 5, 12]. 

According to authoritative guidance from Google's web.dev, the `subgrid` parameter functions as a value used in place of a standard list of grid tracks [cite: 2]. The element spanning its parent's grid effectively passes those exact same rows and columns down to its own children, making the complex macroscopic layouts of a web application strictly penetrable by deeply nested components [cite: 2]. Today, Subgrid is recognized as "Baseline 2023," achieving ubiquitous support across Chrome, Edge, Firefox, and Safari (specifically beginning in versions Chrome 117, Safari 16, and Firefox 71) [cite: 2, 13].

***

## Developer Use Cases

To comprehensively understand the impact of CSS Subgrid, it is necessary to examine the distinct developer use cases and layout problems it inherently solves. Web developers utilize Subgrid to manage intricate relationships between DOM elements that reside in separate sub-trees.

### 1. Card Components with Repeating Rhythms

Perhaps the most universally recognized use case for CSS Subgrid is the "Card UI" pattern. In modern web design, developers frequently display a collection of semantic `<article>` or `<li>` cards in a horizontal row [cite: 14, 15]. A standard card often contains a header, a primary content block (such as an image or text description), and a footer [cite: 9, 16].

Before Subgrid, if the text description of the first card spanned three lines, but the description of the second card spanned only one line, the footers of the two cards would not align horizontally [cite: 13]. The traditional CSS Grid approach handled the outer boundaries of the cards, ensuring the cards themselves were the same height, but the *internal* layout of each card was an isolated formatting context [cite: 14, 17].

**The Subgrid Solution:**
By declaring the card wrapper as a grid item that spans multiple rows of the parent container, and subsequently declaring the card itself as a subgrid, developers force the inner children (header, content, footer) to participate in the parent's row tracking.

```css
/* The Parent Container */
.card-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  /* Three rows explicitly defined for the card internals */
  grid-template-rows: auto 1fr auto; 
  gap: 1rem;
}

/* The Nested Subgrid Card */
.card {
  display: grid;
  /* The card spans the three rows defined by the parent */
  grid-row: span 3;
  /* The card adopts those three rows for its own children */
  grid-template-rows: subgrid; 
}
```

In this architecture, the `1fr` row defined by the parent grid dynamically expands to accommodate the tallest content block among *all* sibling cards, forcing every other card's `1fr` row to match that precise height [cite: 9, 16]. Consequently, every card aligns perfectly, regardless of the variability in user-generated content [cite: 16, 17].

### 2. Full-Bleed Layouts and Macro Device Grids

Another prominent use case highlighted by Chrome's authoritative guidance involves constructing macro-level "device layouts" where named grid tracks are passed down through a complex DOM tree [cite: 2]. 

Many modern web layouts feature constrained central content columns combined with "full-bleed" elements (such as hero images or banners) that deliberately break out of the central container to span the entire viewport width. Historically, developers utilized negative margins or viewport width (`100vw`) calculations to force elements outside of their localized container constraints.

**The Subgrid Solution:**
Subgrid facilitates the creation of a master grid with specific named lines (e.g., `fullbleed-start` and `fullbleed-end`). The main layout container can act as a subgrid, seamlessly passing these named lines down to its children [cite: 2]. 

```css
.device-layout {
  display: grid;
  grid-template-columns: 
    [fullbleed-start] 1fr 
    [content-start] minmax(auto, 800px) 
    [content-end] 1fr 
    [fullbleed-end];
}

.app-container {
  display: grid;
  grid-column: fullbleed; /* Spans from fullbleed-start to fullbleed-end */
  grid-template-columns: subgrid; /* Passes these columns down */
}

.nested-hero-image {
  /* Safely references the grandparent's named lines */
  grid-column: fullbleed; 
}
```
This paradigm creates a one-liner solution that elegantly replaces mathematical hacks, directly tying deeply nested media to the global layout grid without sacrificing semantic HTML encapsulation [cite: 2].

### 3. Complex Form Layouts and Input Alignment

Enterprise software, dashboards, and intricate data-entry applications rely heavily on HTML forms. A common design requirement is to perfectly align `<label>` elements with their corresponding `<input>` fields across multiple rows, while ensuring the form structure maintains strict semantic associations (e.g., wrapping label/input pairs in a list item `<li>` or an independent `<div>` for accessibility styling).

When label and input pairs are enclosed within independent wrappers, they lose awareness of the width of adjacent sibling wrappers. This historically required rigid `width` definitions or HTML tables to simulate alignment [cite: 10, 16].

**The Subgrid Solution:**
According to W3C specifications, Subgrid directly targets this scenario. A parent `<form>` or `<ul>` can establish a two-column grid (one column for labels, one for inputs). Each `<li>` wrapper acts as a subgrid, spanning both columns. The wrapper delegates the label to column 1 and the input to column 2 [cite: 12, 16].

```css
ul.form-layout {
  display: grid;
  grid-template-columns: max-content 1fr;
}

li.form-group {
  display: grid;
  grid-column: span 2; /* Span the parent's two columns */
  grid-template-columns: subgrid; /* Inherit the columns */
}

li.form-group label {
  grid-column: 1; /* Aligns to max-content */
}

li.form-group input {
  grid-column: 2; /* Aligns to 1fr */
}
```

### 4. Dashboard Widgets and Rule-Based Data Lists

In web platforms like project management tools (e.g., Jira sprints), developers display lists of statuses, each containing multiple data objects. The description content of these items varies dynamically [cite: 18]. Regardless of length, the height of each respective data row must remain uniform to maintain visual harmony [cite: 18]. 

While Flexbox can simulate some alignment by distributing remaining space (via `flex: 1`), Flexbox is fundamentally a one-dimensional layout system that fails to coordinate dimensions across independent structural containers [cite: 19]. Subgrid guarantees that widgets, charts, and table headers align cleanly across varied containers by forcing them all to respect a unified grid template dictated by the overarching application state [cite: 16, 18].

***

## Implementation Patterns

Deploying CSS Subgrid effectively requires an understanding of syntax combinations, naming conventions, inheritance patterns, and nesting strategies. 

### Syntax and Track Inheritance

Subgrid is not an independent CSS property; rather, it is a specific keyword value assigned to `grid-template-columns` and/or `grid-template-rows` [cite: 5, 18]. 

To invoke subgrid capabilities, two critical conditions must be met:
1. The element must itself be declared as a grid container (`display: grid`). Omitting this declaration prevents the element from establishing a grid formatting context, rendering the `subgrid` keyword inert [cite: 6].
2. The element must be a direct item of a parent grid container and must span the requisite tracks it intends to inherit [cite: 5, 16].

A subgrid can be applied to either a single axis (rows or columns) or both axes simultaneously. If an axis is not subgridded, it behaves as a standard, independent nested grid [cite: 1, 5].

```css
.parent {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 100px);
}

.child {
  /* Span 3 columns and 2 rows on the parent grid */
  grid-column: 2 / 5;
  grid-row: 1 / 3;
  
  display: grid;
  /* Subgrid the columns, establish independent tracks for the rows */
  grid-template-columns: subgrid; 
  grid-template-rows: 50px 50px; 
}
```

### Line Naming and Placement Conventions

One of the most potent architectural features of Subgrid is its treatment of grid lines. 

**Inheritance of Line Names:**
When a parent grid contains explicitly named lines (e.g., `[sidebar-start]`), those line names traverse down into the subgrid. The children of the subgrid can reference the grandparent's line names to dictate their placement [cite: 1, 20].

**Resetting Line Numbers:**
Despite inheriting track *sizes* and line *names*, a subgrid strictly isolates its numeric line indices. According to W3C specifications and MDN documentation, line numbering restarts inside the subgrid [cite: 1, 11]. Column line 1 inside the subgrid always corresponds to the first edge of the subgrid itself, regardless of where the subgrid is physically positioned within the parent container [cite: 1, 20]. 
This is a highly beneficial pattern for modular component design. It allows developers to safely lay out internal component structures using predictable numerical indices (e.g., `grid-column: 1 / 3`), knowing that the component will not break if it is relocated to a different sector of the macro-grid [cite: 1].

**Local Line Naming:**
A subgrid can declare its own localized line names that do not leak upwards into the parent grid. This is accomplished by appending a space-separated list of line names immediately following the `subgrid` keyword [cite: 5, 20].

```css
.subgrid-container {
  display: grid;
  /* Injects local names subcol-1, subcol-2, etc. onto the inherited tracks */
  grid-template-columns: subgrid [subcol-1] [subcol-2] [subcol-3];
}
```
*Note: The number of line names appended to the subgrid declaration should ideally match the number of lines the subgrid spans across the parent grid. Any excess names defined by the developer are simply ignored by the rendering engine [cite: 5].*

### Gap Inheritance and Customization

By default, a subgrid automatically inherits the `gap`, `column-gap`, and `row-gap` values explicitly set by its parent grid [cite: 18, 20]. This ensures cohesive rhythmic spacing throughout the layout hierarchy without necessitating redundant CSS variables [cite: 1, 21].

However, developers possess the architectural flexibility to override these inherited gaps [cite: 1, 21]. If a parent grid has a `gap: 20px`, a subgrid can explicitly declare `gap: 0`. In such an instance, the grid cells of the subgrid essentially gain space, absorbing the overridden gap area. The grid line continues to run precisely down the geometric center of the original gap space, ensuring that track alignment remains perfectly synchronized while visual spacing is altered [cite: 20].

| Context | Inherited `gap` Behavior | Override Capability | Sizing Impact |
| :--- | :--- | :--- | :--- |
| **Independent Nested Grid** | Does not inherit parent gaps. | Standard `gap` property applies. | Independent of parent track alignment. |
| **Subgrid** | Automatically matches parent gaps. | Can override using `gap` locally. | Grid cells expand/contract into the gap space; track alignment is maintained. |

### Infinite Nesting Capabilities

There is theoretically no depth limit to subgrid nesting [cite: 21, 22]. As long as every descending parent element in the DOM tree acts as a grid container (`display: grid`), it can continuously pass track parameters downward via the `subgrid` keyword [cite: 21, 22]. 

When utilizing multi-layered subgrids, the sizing and alignment of an element deep in the tree are dictated by the top-level parent's track definitions, while its explicit placement coordinates (`grid-column`, `grid-row`) remain strictly localized to the direct parent grid it resides within [cite: 22].

***

## Architectural Trade-offs

When building complex two-dimensional web layouts, developers must choose between CSS Subgrid, `display: contents`, and standard independent nested grids. Each paradigm presents specific architectural trade-offs.

### Subgrid vs. `display: contents`

Prior to the ubiquitous browser support for CSS Subgrid, developers widely relied on `display: contents` to force grandchildren into a parent's grid context [cite: 10, 14]. The `display: contents` property causes an element's CSS rendering box to essentially vanish, effectively promoting its direct children to act as direct children of the surrounding container [cite: 10].

**The Trade-off: Accessibility and Semantics**
While `display: contents` accomplishes the goal of visual grid alignment, it suffers from severe historical and architectural drawbacks:
1. **Accessibility Bugs:** Browsers originally implemented `display: contents` in a manner similar to `display: none`, inadvertently stripping the element entirely from the browser's accessibility tree [cite: 3, 4]. This means that semantic wrappers—such as a `<article>` denoting a distinct card, or a `<ul>` denoting a list—are ignored by screen readers, degrading the user experience for visually impaired users [cite: 3, 4].
2. **Loss of Boundary Constraints:** By dissolving the wrapper element, the developer loses the ability to style the boundary itself. Applying a border, a background color, or localized padding to a "card" becomes impossible because the card's box no longer exists in the formatting context [cite: 10, 14].

CSS Subgrid solves this definitively. By retaining the element's box (`display: grid`), Subgrid preserves the DOM node within both the accessibility tree and the layout engine, explicitly controlling how the children participate in the grandfather's grid without sacrificing semantic hierarchy or component stylability [cite: 9, 16].

### Subgrid vs. Independent Nested Grids

An independent nested grid is created by declaring `display: grid` on a child item without utilizing the `subgrid` keyword. 

**The Trade-off: Alignment vs. Extensibility**
*   **Independent Grids:** Ideal when an internal component requires a bespoke layout that should categorically *not* affect the surrounding page structure [cite: 8]. For instance, a localized flexbox or independent CSS grid might govern a highly specific internal interactive widget where macro-alignment is irrelevant [cite: 8, 12].
*   **Subgrid:** Required when siblings spanning different localized wrappers must remain visually synchronized. The trade-off is coupling. A subgrid tightly couples the child's layout capacity to the parent's explicitly defined track constraints.

***

## Technical Caveats

While Subgrid represents a massive leap forward in layout mechanics, it introduces nuanced technical caveats that engineers must carefully account for to avoid rendering errors.

### 1. Lack of Implicit Tracks in Subgridded Dimensions

A critical behavior defined in the W3C CSS Grid Layout Module Level 2 specification is that subgrids **cannot** generate implicit grid tracks within a subgridded axis [cite: 1, 5]. 

In a standard grid, if a developer attempts to place 12 items into a grid explicitly defined to hold only 10 items, the auto-placement algorithm automatically generates implicit tracks to accommodate the overflow [cite: 23, 24]. 
Conversely, because a subgrid's tracks match up exclusively to the tracks reserved by its parent grid, the subgrid is entirely devoid of implicit track generation [cite: 5]. If a developer attempts to auto-place 12 items into a subgrid that only spans 10 parent cells, the excess items are permanently clamped [cite: 1, 5]. The browser forces the additional items into the very last available track of the subgrid, leading to overlapping content and layout failure [cite: 1, 5]. 

### 2. Dimension Clamping 

Subgrids are strictly bounded by their declaration within the parent grid [cite: 5]. If an item nested *inside* the subgrid is instructed to span an area larger than the subgrid itself (e.g., the subgrid spans 2 columns, but its child is instructed to span 3 columns), the browser's layout engine intervenes. It will actively "clamp" the child's size to the maximum geometric limits of the subgrid (in this case, clamping it down to 2 columns) [cite: 5]. Furthermore, if a child item is explicitly placed at a grid coordinate that exists entirely outside the subgrid's boundaries, the item is forced into the last grid track of the subgrid [cite: 5].

### 3. Missing `display: grid` Declarations

A common stumbling block among developers is the misconception that the `subgrid` keyword autonomously generates a grid formatting context. This is false [cite: 6]. 
A subgrid definition is only valid if `display: grid` is applied to the child element [cite: 6]. Without `display: grid`, the element defaults to standard flow layout (`display: block` or `inline`), completely ignoring the `grid-template-columns: subgrid` declaration without throwing a formal syntax error [cite: 18].

### 4. Mutually Exclusive Single-Axis Behavior

While Subgrid supports alignment on both axes simultaneously (`grid-template-columns: subgrid; grid-template-rows: subgrid;`), developers occasionally conflate the functionality into a single property. The `subgrid` property only affects the specific dimension to which it is applied [cite: 5, 23]. If a developer wants a subgrid to manage both rows and columns, the `subgrid` keyword must be explicitly declared for *both* template properties. A failure to apply it to both results in one axis inheriting the parent tracks while the other defaults to standard, decoupled nested grid behavior [cite: 1, 23].

***

## Conclusion

The standardization of CSS Subgrid marks a definitive shift in frontend architecture, directly solving the longstanding fragmentation between semantic HTML DOM structures and cohesive, multi-level two-dimensional design. By granting developers the capability to pass grid track specifications, gap rules, and named lines recursively down the DOM tree, Subgrid renders outdated layout hacks—such as fixed-height enforcement and `display: contents` overrides—largely obsolete. Provided engineers adhere to strict spanning rules and account for the lack of implicit track generation, CSS Subgrid delivers an unprecedented level of maintainable, robust layout control native directly to the browser.

***

## Sources

*   [cite: 23] Pixel Free Studio, "Getting Tripped Up by CSS Subgrid: Common Pitfalls Explained," Oct 2024. 
*   [cite: 14] G. Perrucci, "CSS Subgrid: Consistent Complex Layouts," Nov 2025. 
*   [cite: 19] Talentica, "Subgrid: An In-Depth Look At The Recent CSS Grid Layout," Feb 2023. 
*   [cite: 8] WebDesign TutsPlus, "CSS Subgrid Features, Syntax, and the Problem It’ll Solve," May 2019. 
*   [cite: 6] J. Comeau, "CSS Subgrid," Nov 2025. 
*   [cite: 10] K. Bellows, "Why We Need CSS Subgrid," Jan 2019. 
*   [cite: 1] MDN Web Docs, "CSS Subgrid," Nov 2025. 
*   [cite: 2] Chrome Web.dev, "CSS Subgrid," Sep 2023. 
*   [cite: 16] S. Gupta, "CSS Subgrid: Unlock Next-Level Layout Control," Sep 2025. 
*   [cite: 18] Melin Blog, "Subgrid Use Cases," Dec 2024. 
*   [cite: 13] I. Shadeed, "Learn CSS Subgrid," May 2022. 
*   [cite: 1] MDN Web Docs, "CSS Subgrid Caveats," Nov 2025. 
*   [cite: 5] Codrops, "CSS Subgrid Caveats," Dec 2019. 
*   [cite: 19] Talentica, "Need of CSS Subgrid," Feb 2023. 
*   [cite: 22] Prismic, "CSS Subgrid Caveats," Aug 2025. 
*   [cite: 17] FreeCodeCamp, "What is CSS Subgrid," Aug 2024. 
*   [cite: 2] Chrome Web.dev, "CSS Subgrid Fullbleed," Sep 2023. 
*   [cite: 13] I. Shadeed, "Learn CSS Subgrid," May 2022. 
*   [cite: 15] J. Bridgforth, "Adventures in Subgrid," Mar 2026. 
*   [cite: 9] Medium, "CSS Subgrid: Making Complex Layouts Behave," Nov 2025. 
*   [cite: 3] R. Andrew, "Grid Content Re-ordering and Accessibility," Mar 2021. 
*   [cite: 4] MDN Web Docs, "Grid Layout and Accessibility," Nov 2025. 
*   [cite: 10] K. Bellows, "Why We Need CSS Subgrid," Jan 2019. 
*   [cite: 6] J. Comeau, "CSS Subgrid Contexts," Nov 2025. 
*   [cite: 1] MDN Web Docs, "Subgrid and Gaps," Nov 2025. 
*   [cite: 2] Chrome Web.dev, "CSS Subgrid Tools," Sep 2023. 
*   [cite: 5] Codrops, "CSS Grid Layout Module Level 2: Subgrid," Dec 2019. 
*   [cite: 11] W3C, "CSS Grid Layout Module Level 2 (Working Draft)," Apr 2018. 
*   [cite: 7] CSS-Tricks, "A Complete Guide to CSS Grid Layout," Feb 2026. 
*   [cite: 12] W3C, "CSS Grid Layout Module Level 2 (Candidate Recommendation Draft)," Mar 2025. 
*   [cite: 20] Smashing Magazine, "CSS Grid 2," Jul 2018. 
*   [cite: 24] Medium, "CSS Grid / Nested Grid," Apr 2022. 
*   [cite: 21] 12 Days of Web, "CSS Subgrid," Dec 2022.

**Sources:**
1. [mozilla.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9jkyvnvSSFeuIiHOR5syXNzU2dolnRmJ_cNs7OSzEWHFH4lfigl1xfbdjl4n3IQ2V6bsWWaHQH1KBR0VCGXgkrxvBSuixzXA2bXYE5_zcVEuJN2WLRCa2SC2PagKt1oQh1uCH_7JUGR7n99Oe3kgaZk77S1vAGRmrA9Gor8BIN0o=)
2. [web.dev](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGlpWSbk9NoHeU7Yn0J2VVsEwUcsyP1Q5kbld_HQo61mmoH_3bBfTj0tY2YEqYfZKikpaDaiRWCjMU9tc-kiV_RMOAm1qTyR9NoAoj_LDGXi6Q2c2nNPOY0cy0=)
3. [noti.st](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQETe87kyewzZ2by77KBJyI3olifAhouVbSrDt1rKoTorlKW6IO16uR7nHNBqixKUoe_QuWyyNTb_TOM_6zQt2rMmwGq32A8m-cgPRbohF91S4ZbWaoYa8__aGadrBIR_Dz3NEYFN1YBJchMw4D6gUE6UhbEhu_O1dCAfRcbst63Rey9eBo=)
4. [mozilla.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEby59Eq5L_eqm-M5sk388WtsQJGromNr1Y_U4l7mHEcWk41JSb-s0QmUjiq5-3VNYxuk4BJ1kifv0OikFlqks8zBr_IMWZYIrHvtj_PBRkgeJ60207t1TqstIbqlQEh_O1wfueQJ4_U-qHpX4tRBDcA-73-rsjr_dHmSqw3YtmNxdSDfn4mBk=)
5. [tympanus.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHGwTQLWc4BRlIU67WwrGnxZEg-tcUjMU8xe6GXo_YjE1nLEJWA7a8jEkmEBGrhQ4Dyt0uQX8qnkN6VqYrDQT4bd6XdlddSBcpONJXoVPX2r1SFE8057jcTZbLlWfrRieWoJ1n0lj4p-RU=)
6. [joshwcomeau.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF8Ql0E0gumujSh8ByBcsf8AKLoM2L9J_SbUAV9U5AwJkDxzSWTOI7ECn6_r8GDOb22vlzEBY_F8qBemLOsXfMdqm6hiosX0HdywxHx2U-jjlLYgonBPJw4Wm59dq6D)
7. [css-tricks.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHc5IKazSjFwXGwcyrMqajzPXePTkUC78koPe5pmBws9Gk9L_lKescN5Su63np-UYBc1gO8yhEqJKE6fjNDP1BiI9p1LxVQv3ZesBWVp-QDT3J45V-jNrCzKMdf_JM1Orhoh5_NR2YtqNX4h_M=)
8. [tutsplus.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFlRid0zGpNW4-KHzCAx0BsF0oqFdEwMWleuIIUJfd6GkIHciIAjJUDXhhu5Z6V-rlPGWhXGwEMbZiKoxUM05whZN3cZ1TukB46jmNEInMF09RaA1vXNb5T15EY7-OwKB4dqpbqV7-znb6aITtYltJmdNp0ekwdgWANflKBhBOuX80tr409CDduHL7nP-SkY-DkgjPxJeyT)
9. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGoFaKs_7L1T2QFtCxu1f6aFUYp8Z7GXjGDNkpg9KMBDMEl-YgT9NAdEYZZtEs4YWyy4eXP9YBPk24pRuhPURN4p166IKVwp6FvHjJGw6MPFuFMxC_j-zZY6V0VpyikEpnIb-6mnCIBftWbuq9ynmjj7r_cndcxvDkQGNYK7S4f66zjDXqchll-MuKIhPMeT-W5)
10. [dev.to](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGciR2BqO0aJ8D2d7RpKdHrdFaethnh1FEzxAjSP8PM3eVKKkBq7dl6HkLC10cBv2KlkgvpNNyWbCTj2wraIm0p2_TxdyqsKr_C3iOsUF4rg9PO-n8ituIOl1LyL-Uhu83Nstj157MKzMMqhDQ=)
11. [w3.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE7_JVt7PauxUdlRya6eorvI1Hr2xGFlGWfJckJ5cNj3QawBeC0tNe6xfbnvAYGlXRpR6yK2Qp9VAhc0EGkqTxiRerBFUcRqDsRg9mG5Lchsc6ppZ3o2sc-ZJiqez1aYkm-riEIXcVnKw==)
12. [w3.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGGw8hYZZTbcYQxDb-RelKD2AJw4Dy--_1kCRp7DO_I-E7cbws7yST4uZ5hYLym9uh25LepI3jreryyaOE1aWapq_ZYbyHLdOBNoRYJLYsZtGJAL2Ra3TE=)
13. [ishadeed.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH0mu9FH6aSkZhlUxg2VWmj4-ZCmLWnwVBoODA79Q3hFxNfRPId0j4s3lAAvJ3Ef6regmCZfVIBClYGMMWG7s1YYvffGfIH0E5EVwZjScwKav6FgpYLou6i1btmGf1tkAIiYpkaBA==)
14. [gperrucci.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEhm-5_-Sgw5dF0NJi0p72Okzc5peBz_QBHx8ocQivXzLCl8TN_1U1xLi_nuc6BWeO0iQHCaZu9ElxzvR2enVE6TjggcnQqACTOESyb85Zodf3mc_u-UkOwyQh5pMEd84tcqkPHMFmc-cQ_Cw_VuHzD5vxVtATcJ-ATZAYK_99o)
15. [jeffbridgforth.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHC-fiFOuuLKlV2Hgmm71_3lP4p3EgoeWCq1A5eaEVdrhio9MZlKgWFGVmkoOVCBpzQE3T0wEUDxJLAK2KvWlAssezH4xj3ig8WoRKNZe8VDB2Q7SBug0Eglhs1SHDClEnsTgUZ2q3J)
16. [dev.to](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAgWNOuoiR2oRAsYTiKMHcQmaxe6WgRfltZicmHjyypt_vvpWCxSi0k0XqF_drGo635NINUHcuJBs_3qb82mXKL5B9A9QrvDT9Rjyjlkr5ERff26CO75NH2kEr3rFjtHWbSCozrkCtce8sIcMfGqeqtBhPiIBEQLjUcpWFjwILu8r9NbhWCxSJA2CfoCUNHueF1wmyhNJHJfdw39-De7-3duV9Wwgg_1Y=)
17. [freecodecamp.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHes7MmLnM8pOtQpfXCljw_Ux6wR44uyVG1ywJLgNgGB0OJZQJjw4-fVO2cFM5DUC8FNWCCtHgqBrYcqo6qIiVYLO4-RdCIIQHHNqh8AtytihEgg9rXniKNQPt1kbyqsZaqTdkv-q9h2jqvQhU=)
18. [vercel.app](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEnCV4ejWL5W_01qrElov0tgIVDHtFjxFvwnzHBJJjcBhnV8O4_jsnHcYdRBCI3yYZtGlsR4gQ4dMf05a1ZqLI2Dp0JnawD9iYWgl9mE1nCBEblMfjCSoH77npF6y-A)
19. [talentica.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE-ziH_NCEF0EgAovvsju20dcMQKXRqKQYthDNXHoaOLHH8QKHzKlDhoRUAZo8orWLcEb-GW0zOaOJMN0stkSwEHaBUuABFbFIkFPI5_gJ31vkLV1jnT2hIvs_zkcY2RTBf0rrbh9W6cWi-_pzBYiP9GqPiMQiUrXDTJqU78oPJg0YbMAVaROg-sT7bgC0=)
20. [smashingmagazine.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqL5JW2BcYHDuDs29agvfbGq5e-Wa-OZw6GsIlfcOif7mJvf-rxTEph7WbHLKE-pVPthqjrdnbtWO3bCYoL-8rkYoQZyJH8sTaBFnviJJjeRjMEixUZSVt23GsiLCktQn4flOoci9XfLnN)
21. [12daysofweb.dev](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHyNl7fenSxolBl0enfGhknGxymtk-gLJu-9ITeYQyl3woLfuVS2jbRjLI3mJAQEhP3hZo6Zzsu5-D9ezXgkHOF7aNxPNsHUDRQYBnE7R22EzZk2zIL8RqpZbmru884SA==)
22. [prismic.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGOLHz1rJEN4yVQBM1mqA7fPBQM0r80qFhzCV5RBGDhAFG25SKvoKrPvrDs2RjOkHphr5tN2X9a3391JDCT3EWZ75JyR7qw_wbSxt2V9O2kBxbfGoVZpB27UQ==)
23. [pixelfreestudio.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGamb3e817cA2-LMLfK3zjsp2TxeVs89_UPpqnuMzP32YxDNvz1IhX1X78JioO1xVuDJvWYKBtxcfJD2riKQgSqx0b2M-inEEXG1ndFTdbJBDH9Dv3E1TI8T2M4YLSdskioM201k5ARfcUV81--uwCH6nCFcskccHf3psWY-G1fFLGMTOIS_g27-Ul9MqmCffIqrp0=)
24. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFSTTOCjxjzt2JRTQhuVZWImsDtxj3f5AeOabUBety39X2-HoZFbOJBcopV-xh62VVB8wnf8AzXuV2I7YZTjUPC1dkHgZqLPV_211ztFebt58MRQyvMrWIjt4M81FkGGP-VlCZgcZUTemBVDz9qLno01revdsIC-4oHPA==)
