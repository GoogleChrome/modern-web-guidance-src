---
description: Use logical properties in CSS to create designs that adapt to different writing modes and languages.
filename: logical-properties-for-internationalization
category: ui
---

# Internationalization with Logical Properties

## Best Practices

The World Wide Web is available to everyone in the world. To make your content available to anyone, regardless of their location, device, or language, embrace internationalization. Preparing your content and designs for an international audience is the driving force behind this.

### Logical Properties vs. Directional Properties

English is written from left to right and top to bottom. However, not all languages follow this convention. Languages like Arabic and Hebrew read from right to left, and some Japanese typefaces read vertically. To accommodate these different writing modes, logical properties were introduced in CSS.

Directional properties like `margin-left` refer to the physical layout of the user's device. Logical properties, on the other hand, refer to the edges of a box as they relate to the flow of content. If the writing mode changes, CSS written with logical properties will update accordingly.

For example, `margin-left` always refers to the margin on the left side of a content box. In contrast, `margin-inline-start` refers to the margin on the left side of a content box in a left-to-right language, and the margin on the right side of a content box in a right-to-left language.

**DO** use logical properties in your CSS to ensure your designs adapt to different writing modes. Avoid directional properties.

<div class="wd-compare">
  <div class="compare-worse">Don't</div>
  <pre class="prettyprint lang-css">.byline {
  text-align: right;
}
</pre>

</div>

<div class="wd-compare">
  <div class="compare-better">Do</div>
  <pre class="prettyprint lang-css">.byline {
  text-align: end;
}
</pre>

</div>

When CSS has a specific directional value like `left` or `right`, there's a corresponding logical property.

-   `margin-inline-start` corresponds to `margin-left` in left-to-right languages.
-   `margin-inline-end` corresponds to `margin-right` in left-to-right languages.
-   `block-start` corresponds to `top` when text is written top-to-bottom.
-   `block-end` corresponds to `bottom` when text is written top-to-bottom.

Modern CSS layout techniques like grid and flexbox use logical properties by default. Thinking in terms of `inline-start` and `block-start` instead of `left` and `top` will make these modern techniques easier to understand.

Consider a common pattern like an icon next to some text. Instead of thinking "the label should have a margin on the right," think "the label should have a margin on the end of its inline axis."

<div class="wd-compare">
  <div class="compare-worse">Don't</div>
  <pre class="prettyprint lang-css">label {
  margin-right: 0.5em;
}
</pre>

</div>

<div class="wd-compare">
  <div class="compare-better">Do</div>
  <pre class="prettyprint lang-css">label {
  margin-inline-end: 0.5em;
}
</pre>

</div>

### Identifying Page Language

**DO** identify the language of your page by using the `lang` attribute on the `html` element.

```html
<html lang="en">
```

You can be more specific, for example, to declare a page in US English:

```html
<html lang="en-us">
```

Declaring the document's language is beneficial for search engines and assistive technologies like screen readers and voice assistants, helping them pronounce content correctly. The `lang` attribute can be applied to any HTML element to indicate a language switch within the page.

```html
<p>I felt some <span lang="de">schadenfreude</span>.</p>
```

### Identifying Linked Document Language

**DO** use the `hreflang` attribute on links to describe the linked document's language. It accepts the same language code notation as the `lang` attribute.

```html
<a href="/path/to/german/version" hreflang="de">German version</a>
```

If the link text is also in German, use both `hreflang` and `lang`:

```html
<a href="/path/to/german/version" hreflang="de" lang="de">Deutsche Version</a>
```

The `hreflang` attribute can also be used on the `link` element in the `head` of your document:

```html
<link href="/path/to/german/version" rel="alternate" hreflang="de">
```

Unlike the `lang` attribute, `hreflang` can only be applied to `a` and `link` elements.

### Design Considerations for Internationalization

When designing websites for translation into other languages and writing modes, consider these factors:

*   **Column Width:** Some languages have longer words. Avoid designing narrow columns and consider using CSS `hyphens` to introduce hyphenation.
*   **Line Height:** Ensure `line-height` values can accommodate characters with accents and diacritics, as lines that look fine in English might overlap in other languages.
*   **Web Fonts:** If using web fonts, make sure they support a broad range of characters for the languages you'll be translating into.
*   **Text in Images:** **DO NOT** create images with text. Instead, separate text from images and use CSS to overlay the text. This avoids the need for creating separate images for each language.

## Think Internationally

Attributes like `lang` and `hreflang` enhance HTML's internationalization capabilities. Similarly, logical properties make CSS more adaptable. While shifting from directional to logical properties might require adjustment, it's crucial for creating truly responsive layouts.

### Check your understanding {:.hide-from-toc}

Test your knowledge of internationalization.

<div class="wd-assessment"><devsite-multiple-choice>
   <div><p>In English, the physical <code>right</code> side of a box, is logically which side?</p>
</div>
<div>
   <div><code>block-start</code></div>
   <div>Try again! In English this is <code>top</code></div>
</div>
<div>
   <div><code>block-end</code></div>
   <div>Try again! In English this is <code>bottom</code></div>
</div>
<div>
   <div><code>inline-start</code></div>
   <div>Try again! In English this is <code>left</code></div>
</div>
<div correct>
   <div><code>inline-end</code></div>
   <div>🎉</div>
</div>
</devsite-multiple-choice>
<devsite-multiple-choice>
   <div><p>Which attribute should you add to your HTML to make it more meaningful for internationalization?</p>
</div>
<div>
   <div><code>english</code></div>
   <div>Try again!</div>
</div>
<div correct>
   <div><code>lang</code></div>
   <div>🎉 This signals to the browsers which language the document is in, which assists in setting the writing mode, document direction and translations.</div>
</div>
<div>
   <div><code>language</code></div>
   <div>Try again!</div>
</div>
<div>
   <div><code>i18n</code></div>
   <div>Try again!</div>
</div>
</devsite-multiple-choice>
</div>