# Prepare Store Graphics

Use this guide when creating or reviewing the visual assets required for a Chrome Web Store listing.
A missing store icon or screenshot is an automatic rejection.

## Required Assets

### Store Icon — 128×128 PNG [REQUIRED]
- Exact dimensions: 128×128 pixels
- Format: PNG
- Displayed in the store listing, search results, and Chrome's extension manager
- Must be readable at small sizes (it renders as small as 16px in some UI)
- No transparency issues — use a solid or semi-transparent background

Design tips:
- Use a simple, recognizable symbol — not a wordmark
- High contrast works better at small sizes than gradients
- Match your extension's brand colors

### Screenshots — 1280×800 or 640×400 [REQUIRED: at least 1, max 5]
- Exact dimensions: 1280×800 px or 640×400 px (both accepted)
- Format: PNG or JPEG
- At least 1 required; up to 5 total
- Must accurately represent the extension — misleading screenshots cause rejection

What makes a good screenshot:
- Show the extension **in action** on a realistic webpage, not just an empty popup
- Add annotations (arrows, callouts) to highlight key features
- Match the current version of the extension UI — outdated screenshots trigger rejection
- No phone or tablet mockups unless the extension actually works on those devices

Screenshot plan template:
```
Screenshot 1: [Main feature in action — e.g., "Popup open on a news article showing highlights"]
Screenshot 2: [Secondary feature — e.g., "Settings page with theme options"]
Screenshot 3: [Edge case or power feature — e.g., "Export as Markdown modal"]
```

### Small Promo Tile — 440×280 [RECOMMENDED]
- Exact dimensions: 440×280 px
- Format: PNG or JPEG
- Used for featured placements and category pages
- Follow Chrome Web Store branding guidelines: avoid using the Chrome logo or Google branding

### Marquee Promo Tile — 1400×560 [OPTIONAL]
- Exact dimensions: 1400×560 px
- Used if your extension is featured on the homepage

## Image Standards

The Chrome Web Store enforces branding guidelines for promotional images:
- Do not use the Chrome logo, Chrome browser window, or Google branding in promo tiles
- Screenshots may show the extension within a browser window
- All images must accurately represent the extension — no mockups of features you haven't built

## Tracking Asset Status

In `CHROMEWEBSTORE.md`, update the Graphics & Assets table as you create files:

```
⬜ Not created
🟡 Needs update (UI changed since last screenshot)
✅ Ready
```

Note the filename so it's easy to find when uploading to the dashboard.
