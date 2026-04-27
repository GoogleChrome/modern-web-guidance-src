# Package and Submit to the Chrome Web Store

Use this guide when preparing to submit an extension for the first time or publishing an update.

## Prerequisites

- A registered Chrome Web Store developer account ($5 one-time fee)
- **2-Step Verification enabled** on the Google account — required as of 2023; submissions
  are blocked without it
- Extension tested locally in unpacked mode with no console errors

## Pre-Publish Checklist

Run through every item before building the ZIP.

### Manifest & Package
- [ ] `manifest_version: 3` — V2 is not accepted for new submissions
- [ ] Version bumped — CWS rejects uploads with version ≤ the published version
      (semver: patch for fixes, minor for features, major for breaking changes)
- [ ] `name` in `manifest.json` matches the store listing name exactly
- [ ] `description` in manifest ≤ 132 chars (shown in `chrome://extensions`)
- [ ] No absolute file paths in manifest — all paths must be relative

### Permissions
- [ ] Minimum permissions only — every declared permission is actually used
- [ ] No unused permissions left over from removed features
- [ ] Every permission has a justification in `CHROMEWEBSTORE.md`
- [ ] `host_permissions` scoped as tightly as possible — `<all_urls>` only if truly needed
- [ ] `activeTab` used instead of `tabs + <all_urls>` where appropriate

### Store Listing Content
- [ ] Extension name, short description, detailed description filled in and specific
- [ ] Single purpose field is narrow and easy to understand
- [ ] No vague marketing language, no keyword stuffing
- [ ] No misleading claims — every listed feature actually works
- [ ] Contact email is valid and monitored (Google sends policy notices here)

### Graphics
- [ ] Store icon: 128×128 PNG, clear at small sizes
- [ ] At least 1 screenshot: 1280×800 or 640×400 px, showing the extension in action
- [ ] Screenshots match the current UI (outdated screenshots trigger rejection)

### Privacy & Compliance
- [ ] Data disclosure form matches actual extension behavior — no mismatch
- [ ] Privacy policy URL is live and loads correctly (visit it yourself)
- [ ] Privacy policy matches the disclosure form
- [ ] `chrome.storage.sync` disclosed as off-device if used
- [ ] No remotely hosted or executed code (all JS bundled in the package)
- [ ] No obfuscated code (minification is fine; obfuscation is not)

### Functionality
- [ ] All features work when loaded as unpacked extension
- [ ] Popup, side panel, options page load without errors
- [ ] No blank popups or crashes
- [ ] Graceful behavior on restricted pages (`chrome://` URLs, PDF viewer, etc.)

### Updates Only
- [ ] `CHROMEWEBSTORE.md` version history updated with new entry
- [ ] "Last Updated" date bumped
- [ ] Descriptions updated if new features were added
- [ ] Permission justifications updated if `manifest.json` changed
- [ ] Screenshots refreshed if UI changed significantly

## Building the ZIP

Create a clean ZIP that excludes development files. Chrome needs only the files the
extension uses at runtime.

```bash
#!/bin/bash
# package-extension.sh

EXTENSION_NAME="my-extension"
VERSION=$(node -p "require('./manifest.json').version")
OUTPUT="${EXTENSION_NAME}-v${VERSION}.zip"

rm -f "$OUTPUT"

zip -r "$OUTPUT" . \
  -x ".git/*" \
  -x "node_modules/*" \
  -x ".env" \
  -x "*.map" \
  -x "tests/*" \
  -x "__tests__/*" \
  -x "*.test.*" \
  -x "*.spec.*" \
  -x ".eslintrc*" \
  -x ".prettierrc*" \
  -x "tsconfig.json" \
  -x "package.json" \
  -x "package-lock.json" \
  -x "webpack.config.*" \
  -x "vite.config.*" \
  -x "rollup.config.*" \
  -x "CHROMEWEBSTORE.md" \
  -x "README.md" \
  -x "CHANGELOG.md" \
  -x ".DS_Store" \
  -x "Thumbs.db" \
  -x "*.sh" \
  -x "store-assets/*"

echo "Packaged: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
```

Maximum ZIP size: 2GB. Most extensions should be well under 10MB.

## Submitting

1. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Sign in and complete 2-Step Verification if prompted
3. Click **Add new item** (first submission) or select your existing item (update)
4. Upload the ZIP file
5. Complete all dashboard tabs:
   - **Store Listing** — name, descriptions, category, screenshots, promo tiles
   - **Privacy** — single purpose statement, data disclosure form, privacy policy URL
   - **Distribution** — visibility (Public/Unlisted/Private), regions, pricing
6. Click **Submit for Review**

**Account limit:** You can publish up to 20 extensions per developer account. Requesting
an increase requires Chrome Web Store staff to review your account history.

## Deferred Publishing

In the submission dialog, you can choose to publish manually after the review passes
rather than automatically. Use deferred publishing when:
- You want to coordinate the launch with marketing, a blog post, or a release announcement
- You're updating multiple extensions and want them to go live at the same time

**Important:** After review approval, you have **30 days** to publish. If you don't publish
within 30 days, the submission reverts to a Draft and you must resubmit for review.

## After Submission

- Review typically takes 1–3 business days for new extensions; updates are often faster (within 24 hours)
- Enable email notifications in your Account settings — Google sends approval/rejection notices there
- You can check status in the developer dashboard
- If rejected, see the `handle-rejection.md` guide
