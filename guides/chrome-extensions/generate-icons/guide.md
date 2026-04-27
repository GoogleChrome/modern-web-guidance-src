---
name: generate-icons
description: Generate and configure the PNG icon files required for a Chrome Extension to appear correctly in the browser UI.
web-feature-ids: []
---

# Generate Extension Icons

Chrome extensions need PNG icon files at specific pixel dimensions. If you reference icon files in `manifest.json`, they must exist — Chrome shows an error for missing icons and the extension may appear broken. If generating icons is impractical, omit them entirely and Chrome uses a default puzzle-piece icon.

## Omit icons if you can't generate real files

This is always better than referencing non-existent files:

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0"
  // No "icons" or "default_icon" — Chrome uses the default icon
}
```

## Generate with Python (Pillow)

```python
# generate_icons.py
from PIL import Image, ImageDraw
import os

os.makedirs('icons', exist_ok=True)

for size in [16, 48, 128]:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    margin = max(1, size // 16)
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 4,
        fill='#4688F1'
    )
    draw.text((size // 2, size // 2), 'E', fill='white', anchor='mm')
    img.save(f'icons/icon-{size}.png')
    print(f'Created icons/icon-{size}.png ({size}x{size})')
```

Run: `pip install Pillow && python generate_icons.py`

## Generate with Node.js (canvas)

```js
// generate_icons.js
const { createCanvas } = require('canvas');
const fs = require('fs');

fs.mkdirSync('icons', { recursive: true });

for (const size of [16, 48, 128]) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.roundRect(1, 1, size - 2, size - 2, size / 4);
  ctx.fillStyle = '#4688F1';
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = `bold ${size / 2}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E', size / 2, size / 2);

  fs.writeFileSync(`icons/icon-${size}.png`, canvas.toBuffer('image/png'));
  console.log(`Created icons/icon-${size}.png`);
}
```

Run: `npm install canvas && node generate_icons.js`

## Manifest reference

Once the files exist, declare them in `manifest.json`. Each file MUST match its declared size:

```json
{
  "icons": {
    "16": "icons/icon-16.png",   // 16×16 pixels
    "48": "icons/icon-48.png",   // 48×48 pixels
    "128": "icons/icon-128.png"  // 128×128 pixels
  },
  "action": {
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  }
}
```

MANDATORY: If you reference icon files in `manifest.json`, `chrome.notifications.create()`, or `chrome.action.setIcon()`, those files must exist with the correct pixel dimensions. Missing or wrong-size files cause silent failures or errors like `"Unable to download all specified images."`.

## Generate a data URL at runtime (no files needed)

For notifications and `chrome.action.setIcon()`, you can generate an icon as a data URL instead of referencing a file:

```js
async function generateIconDataUrl(size = 128) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4688F1';
  ctx.beginPath();
  ctx.roundRect(2, 2, size - 4, size - 4, size / 4);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size / 2}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E', size / 2, size / 2);
  const blob = await canvas.convertToBlob();
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Use in a notification (service worker)
const iconUrl = await generateIconDataUrl(128);
chrome.notifications.create({ type: 'basic', iconUrl, title: 'Done', message: 'Task complete' });
```
