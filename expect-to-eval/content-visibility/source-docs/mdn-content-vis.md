
# content-visibility

Baseline
2024
\*
Newly available

Since September 2024, this feature works across the latest devices and browser versions. This feature might not work in older devices or browsers.

\* Some parts of this feature may have varying levels of support.

- <a href="/en-US/docs/Glossary/Baseline/Compatibility" target="_blank">Learn more</a>
- [See full compatibility](#browser_compatibility)
- <a href="https://survey.alchemer.com/s3/7634825/MDN-baseline-feedback?page=%2Fen-US%2Fdocs%2FWeb%2FCSS%2FReference%2FProperties%2Fcontent-visibility&amp;level=low" target="_blank">Report feedback</a>

The **`content-visibility`** [CSS](/en-US/docs/Web/CSS) property controls whether or not an element renders its contents at all, along with forcing a strong set of containments, allowing user agents to potentially omit large swathes of layout and rendering work until it becomes needed. It enables the user agent to skip an element's rendering work (including layout and painting) until it is needed — which makes the initial page load much faster.

**Note:**
The [`contentvisibilityautostatechange`](/en-US/docs/Web/API/Element/contentvisibilityautostatechange_event "contentvisibilityautostatechange") event fires on any element with `content-visibility: auto` set on it when its rendering work starts or stops being skipped. This provides a convenient way for an app's code to start or stop rendering processes (e.g., drawing on a [`<canvas>`](/en-US/docs/Web/HTML/Reference/Elements/canvas)) when they are not needed, thereby conserving processing power.

## In this article

- [Try it](#try_it)
- [Syntax](#syntax)
- [Description](#description)
- [Formal definition](#formal_definition)
- [Formal syntax](#formal_syntax)
- [Accessibility](#accessibility)
- [Examples](#examples)
- [Specifications](#specifications)
- [Browser compatibility](#browser_compatibility)
- [See also](#see_also)

## [Try it](#try_it)

## [Syntax](#syntax)

### [Values](#values)

[`visible`](#visible)
No effect. The element's contents are laid out and rendered as normal. This is the default value.

[`hidden`](#hidden)
The element [skips its contents](/en-US/docs/Web/CSS/Guides/Containment/Using#skips_its_contents). The skipped contents must not be accessible to user-agent features, such as find-in-page, tab-order navigation, etc., nor be selectable or focusable. This is similar to giving the contents `display: none`.

[`auto`](#auto)
The element turns on layout containment, style containment, and paint containment. If the element is not [relevant to the user](/en-US/docs/Web/CSS/Guides/Containment/Using#relevant_to_the_user), it also skips its contents. Unlike hidden, the skipped contents must still be available as normal to user-agent features such as find-in-page, tab order navigation, etc., and must be focusable and selectable as normal.

## [Description](#description)

### [Animating and transitioning content-visibility](#animating_and_transitioning_content-visibility)

[Supporting browsers](#browser_compatibility) animate/transition `content-visibility` with a variation on the [discrete animation type](/en-US/docs/Web/CSS/Guides/Animations/Animatable_properties#discrete).

Discrete animation generally means that the property will flip between two values 50% of the way through the animation. In the case of `content-visibility`, however, the browser will flip between the two values to show the animated content for the entire animation duration. So, for example:

- When animating `content-visibility` from `hidden` to `visible`, the value will flip to `visible` at `0%` of the animation duration so it is visible throughout.
- When animating `content-visibility` from `visible` to `hidden`, the value will flip to `hidden` at `100%` of the animation duration so it is visible throughout.

This behavior is useful for creating entry/exit animations where you want to, for example, remove some content from the DOM with `content-visibility: hidden`, but you want a smooth transition (such as a fade-out) rather than it disappearing immediately.

When animating `content-visibility` with [CSS transitions](/en-US/docs/Web/CSS/Guides/Transitions), [`transition-behavior: allow-discrete`](/en-US/docs/Web/CSS/Reference/Properties/transition-behavior) needs to be set on `content-visibility`. This effectively enables `content-visibility` transitions.

**Note:**
When transitioning an element's `content-visibility` value, you don't need to provide a set of starting values for transitioned properties using a [`@starting-style`](/en-US/docs/Web/CSS/Reference/At-rules/@starting-style) block, like you do when [transitioning `display`](/en-US/docs/Web/CSS/Reference/Properties/display#animating_display). This is because `content-visibility` doesn't hide an element from the DOM like `display` does: it just skips rendering the element's content.

## [Formal definition](#formal_definition)

|  |  |
|----|----|
| [Initial value](/en-US/docs/Web/CSS/Guides/Cascade/Property_value_processing#initial_value) | `visible` |
| Applies to | elements for which size containment can apply |
| [Inherited](/en-US/docs/Web/CSS/Guides/Cascade/Inheritance) | no |
| [Computed value](/en-US/docs/Web/CSS/Guides/Cascade/Property_value_processing#computed_value) | as specified |
| [Animation type](/en-US/docs/Web/CSS/Guides/Animations/Animatable_properties) | Discrete behavior except when animating to or from `hidden` is visible for the entire duration |

## [Formal syntax](#formal_syntax)

    content-visibility =
      visible  |
      auto     |
      hidden

This syntax reflects the latest standard as per <a href="https://drafts.csswg.org/css-contain-2/" target="_blank">CSS Containment Module Level 2</a>. Not all browsers may have implemented every part. See [Browser compatibility](#browser_compatibility) for support information.

## [Accessibility](#accessibility)

Off-screen content within a `content-visibility: auto` property remains in the document object model and the accessibility tree. This allows improving page performance with `content-visibility: auto` without negatively impacting accessibility.

Since styles for off-screen content are not rendered, elements intentionally hidden with `display: none` or `visibility: hidden` *will still appear in the accessibility tree*.
If you don't want an element to appear in the accessibility tree, use `aria-hidden="true"`.

## [Examples](#examples)

### [Using auto to reduce rendering cost of long pages](#using_auto_to_reduce_rendering_cost_of_long_pages)

The following example shows the use of `content-visibility: auto` to skip painting and rendering of off-screen sections.
When a `section` is out of the viewport then the painting of the content is skipped until the section comes close to the viewport, this helps with both load and interactions on the page.

#### HTML

#### CSS

The `contain-intrinsic-size` property adds a default size of 500px to the height and width of each `section` element. After a section is rendered, it will retain its rendered intrinsic size, even when it is scrolled out of the viewport.

### [Using hidden to manage visibility](#using_hidden_to_manage_visibility)

The following example shows how to manage content visibility with JavaScript.
Using `content-visibility: hidden;` instead of `display: none;` preserves the rendering state of content when hidden and rendering is faster.

#### HTML

#### CSS

The `content-visibility` property is set on paragraphs that are direct children of elements with the `visible` and `hidden` classes. In our example, we can show and hide content in paragraphs depending on the CSS class of parent div elements.

The `contain-intrinsic-size` property is included to represent the content size. This helps to reduce layout shift when content is hidden.

#### JavaScript

#### Result

### [Animating content-visibility](#animating_content-visibility)

In this example, we have a [`<div>`](/en-US/docs/Web/HTML/Reference/Elements/div) element, the content of which can be toggled between shown and hidden by clicking or pressing any key.

#### HTML

#### CSS

In the CSS we initially set `content-visibility: hidden;` on the `<div>` to hide its content. We then set up `@keyframes` animations and attach them to classes to show and hide the `<div>`, animating `content-visibility` and [`color`](/en-US/docs/Web/CSS/Reference/Properties/color) so that you get a smooth animation effect as the content is shown/hidden.

#### JavaScript

Finally, we use JavaScript to apply the `.show` and `.hide` classes to the `<div>` as appropriate to apply the animations as it is toggled between shown and hidden states.

#### Result

The rendered result looks like this:

## [Specifications](#specifications)

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr>
<th>Specification</th>
</tr>
</thead>
<tbody>
<tr>
<td><a href="https://drafts.csswg.org/css-contain/#content-visibility" target="_blank">CSS Containment Module Level 2<br />
# content-visibility</a></td>
</tr>
</tbody>
</table>

## [Browser compatibility](#browser_compatibility)

## [See also](#see_also)

- [CSS Containment](/en-US/docs/Web/CSS/Guides/Containment)
- [`contain-intrinsic-size`](/en-US/docs/Web/CSS/Reference/Properties/contain-intrinsic-size)
- [`contentvisibilityautostatechange`](/en-US/docs/Web/API/Element/contentvisibilityautostatechange_event "contentvisibilityautostatechange")
- <a href="https://web.dev/articles/content-visibility" target="_blank">content-visibility: the new CSS property that boosts your rendering performance</a> (web.dev)
