# CSS `accent-color` property

## Issues

- Browser rendering of accent-color varies. User agents may adjust the supplied accent colour and choose a colour for indicators such as checkbox marks and radio-button dots.
- Chromium and Firefox generally select a contrasting indicator colour. Safari may instead preserve a white indicator in light mode or a black indicator in dark mode, while modifying the accent colour behind it. This adjustment does not always provide sufficient contrast for every supplied colour, so test important combinations in Safari, including both light and dark colour schemes.
- Do not assume that Safari will automatically choose whichever indicator colour provides the best contrast.

## Fallbacks

The `accent-color` property is progressive enhancement.
Browsers that do not support this property will ignore it and use their default UI colors.

