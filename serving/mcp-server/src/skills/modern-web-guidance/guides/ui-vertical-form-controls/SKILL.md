---
description: Enable vertical text display for form controls using the CSS writing-mode property to support international languages.
filename: vertical-form-controls
category: ui
---

# Vertical Form Controls

Reference docs:
- https://drafts.csswg.org/css-writing-modes/

## Best Practices

Use the `writing-mode` CSS property to display text vertically within form control elements. This is particularly useful for East Asian languages that traditionally use vertical scripts.

Supported form controls include buttons, select lists, progress elements, text-based inputs (like `textarea`), and sliders (`<meter>`, `<progress>`, `<input type=range>`).

### Vertical Writing Modes

- **`vertical-lr`**: Sets the block flow direction from left to right.
- **`vertical-rl`**: Sets the block flow direction from right to left.

### Examples

#### Buttons

```css
button {
  writing-mode: vertical-rl;
}
```

```html
<html lang="zh">
<button>请点击</button>
</html>
```

#### `<select>` elements

```css
select {
  writing-mode: vertical-lr;
}
```

```html
<select multiple>
  <option>日本語
  <option>中文
  <option>English
  <option>français
  <option>فارسی
</select>
```

Note: The popup window's options may still be displayed horizontally in current implementations.

#### Text-based inputs

```css
textarea {
  writing-mode: vertical-rl;
  width: 5em;
  height: 20em;
}
```

```html
<textarea>
古池や蛙飛び込む水の音
ふるいけやかわずとびこむみずのおと
</textarea>
```

#### Sliders (`<meter>`, `<progress>`, `<input type=range>`)

```css
input[type="range"], meter, progress {
  writing-mode: vertical-lr;
}
```

To control the direction of the value rendering:
- **Top to bottom**: `direction: ltr;` (default)
- **Bottom to top**: `direction: rtl;`

```css
input[type="range"], meter, progress {
  writing-mode: vertical-lr;
  direction: rtl;
}
```

## Engage and share feedback

To share feedback about these features, file an issue at [crbug.com](https://issues.chromium.org/issues/new?noWizard=true&template=0&component=1456410).