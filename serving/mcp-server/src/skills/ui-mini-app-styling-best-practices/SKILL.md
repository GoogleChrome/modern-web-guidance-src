---
description: Provide a consistent and responsive user interface across various mini app platforms by leveraging their respective styling dialects and responsive pixel units.
filename: mini-app-styling-best-practices
category: ui
---

# Mini App Styling Best Practices

This article discusses how to style mini apps, focusing on the use of CSS dialects and responsive pixels.

## Styling with CSS Dialects and `rpx`

Mini apps use CSS dialects (WXSS, ACSS, TTSS, etc.) that extend standard CSS. A key feature is the `rpx` (responsive pixel) unit, which simplifies adapting designs to different screen sizes and pixel densities.

### Best Practices

- **Use `rpx` for responsive sizing:** Design with `rpx` units to ensure your layouts scale correctly across a wide range of devices. The `750rpx` base width is a common standard.
- **Understand `rpx` conversion:** Be aware that `rpx` is converted to physical pixels based on the device's screen width and pixel ratio. This is similar to Android's density-independent pixels (dp).
- **Leverage platform-specific documentation:** While the concept of `rpx` is consistent, refer to the specific documentation for each mini app platform (WeChat, Alipay, Baidu, ByteDance, Quick App) for any nuances in their CSS dialects.
- **Global vs. Page-specific styles:** Organize your stylesheets effectively. Use a root stylesheet for global styles and individual stylesheets for page-specific customizations.
- **Importing styles:** Use the `@import` rule to import stylesheets, similar to standard CSS.
- **Inline styles with dynamic data:** Styles can be applied inline, including dynamic styling using data binding, mirroring HTML's behavior.

```css
/* app.wxss (or equivalent for other platforms) */
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 200rpx 0; /* Responsive padding */
  box-sizing: border-box;
}
```

```html
<view style="color:{% verbatim %}{{color}}{% endverbatim %};" />
```

## Styling Components

Styles declared on a page can affect all components because mini apps do not use Shadow DOM. This means a global style can cascade down to components unless overridden.

## Fallback Strategies

While not explicitly detailed for styling in the provided text, consider that if specific CSS features beyond basic styling are used, it's good practice to check for browser/platform support, similar to how other web features might require polyfills or fallbacks. However, for the core CSS dialects and `rpx`, broad support is generally expected within their respective ecosystems.