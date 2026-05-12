---
name: chrome-webstore
description: >
  Maintain a CHROMEWEBSTORE.md file tracking all Chrome Web Store publishing metadata for a
  Chrome extension. Trigger on: 'Chrome Web Store', 'publish extension', 'store listing',
  'webstore', 'CWS', 'extension submission', 'permissions justification', 'privacy policy'
  (in extension context), 'store screenshots', 'extension review', 'publish to Chrome',
  'update store listing'. Also trigger when preparing an extension for publishing, updating
  its store listing, responding to a review rejection, tracking a release, writing permission
  justifications, drafting a privacy policy, or managing store assets. Trigger even if the
  user just says "let's publish this" or "prepare for the store" in a Chrome extension
  context. Complements the chrome-extension skill — chrome-extension builds extensions,
  this skill handles getting them into and maintaining them on the Chrome Web Store.
---

# Chrome Web Store Publishing Skill

Manage `CHROMEWEBSTORE.md` — the single source of truth for all Chrome Web Store listing
metadata, permissions justifications, privacy disclosures, version history, and publishing
readiness for a Chrome extension project.

## Core Workflow

Every time you touch a Chrome extension project in a way that affects its store presence,
update (or create) `CHROMEWEBSTORE.md` in the project root. The file tracks everything the
developer needs to fill out in the Chrome Developer Dashboard, so they can copy-paste from
a single doc instead of scrambling at publish time.

### When to create CHROMEWEBSTORE.md

Create it the moment any of these happen:
- The user says they want to publish an extension
- The user asks to "prepare for the store" or "get ready to publish"
- You're building a new extension that will clearly end up on the store
- The user asks about store listing requirements

Use the template in `references/chromewebstore-template.md` as your starting point. Read it
before generating the file.

### When to update CHROMEWEBSTORE.md

Update it whenever:
- **User-facing changes**: Bump the "Last Updated" date, update the feature list in
  descriptions, and add an entry to Version History
- **manifest.json changes**: If permissions, host_permissions, or content_scripts changed,
  update the Permissions Justification section — every permission needs a plain-English
  reason the review team can understand
- **New release**: Add a Version History entry with version number, date, and summary
- **Privacy-relevant changes**: If data collection, storage, or transmission changed,
  update the Privacy & Data Use section and the privacy policy
- **Asset changes**: If icons or UI changed, note which screenshots need refreshing
- **Rejection response**: If the user reports a CWS rejection, update the file with the
  fix and add a note to Version History

### How to fill it out

For each section, pull information from the actual project files:
1. Read `manifest.json` to extract name, version, description, permissions, host_permissions
2. Scan the codebase for data collection (storage, fetch calls, analytics)
3. Check for icon files and their dimensions
4. Look at the extension's UI to understand features for the description

Write store-facing copy in a tone that is specific, honest, and benefit-oriented. The Chrome
Web Store review team rejects vague descriptions. "Makes your life easier" will be rejected.
"Highlights search results on any webpage and lets you save highlights to a local list" will
pass.

## CHROMEWEBSTORE.md Sections

Read `references/chromewebstore-template.md` for the full template. Here's what each section
is for and why it matters:

### Store Listing
- **Extension Name**: Must match manifest.json `name` (max 75 chars)
- **Short Description**: The subtitle shown in search results (max 132 chars). Make it
  count — this is the first thing users see.
- **Detailed Description**: Up to 16,000 chars. Lead with what the extension does in one
  sentence, then list key features, then explain how to use it. No marketing fluff.
- **Category**: Pick the closest CWS category
- **Single Purpose**: One sentence. Narrow and easy to understand. This is heavily
  scrutinized during review.
- **Language**: Primary language of the extension

### Graphics & Assets
Track which assets exist and their status. Required assets:
- Store icon: 128×128 PNG
- Screenshots: 1280×800 or 640×400 (at least 1, up to 5 localized + 5 global)
- Small promo tile: 440×280 (recommended)
- Marquee promo tile: 1400×560 (optional)

### Permissions Justification
This is the #1 reason for first-submission rejection. For every permission in manifest.json
(`permissions` and `host_permissions`), write a clear justification:

```
| Permission | Justification |
|------------|---------------|
| storage | Saves user preferences and highlight data locally |
| activeTab | Reads page content only when the user clicks the extension icon |
| tabs | Displays tab titles in the extension popup for tab management |
```

Keep justifications specific. "Needed for the extension to work" will be rejected.

### Privacy & Data Use
Map directly to the CWS data use disclosure form:
- What data is collected (be exhaustive)
- Whether data is transmitted off-device
- Whether data is used for purposes unrelated to the extension's core functionality
- Whether data is sold or shared with third parties
- Whether data is used for creditworthiness or lending

If the extension collects NO user data, say so explicitly.

### Privacy Policy
- URL where the privacy policy is hosted
- If no data is collected, a minimal privacy policy is still recommended and may be
  required depending on permissions

Read `references/privacy-policy.md` for guidance on generating a privacy policy.

### Version History
Chronological changelog. Each entry has version, date, and what changed. This isn't
published to the store, but it's essential for the developer to track what was submitted
when, and helps when responding to rejections.

### Distribution
- Visibility: Public / Unlisted / Private
- Regions: Worldwide or specific countries
- Pricing: Free or paid (note: paid extensions are rare and have extra requirements)

### Review Notes
A scratch section for communicating with the review team or tracking rejection reasons
and how they were resolved.

## Pre-Publish Checklist

Before the user submits to the Chrome Web Store, verify all of these. Read
`references/review-checklist.md` for the full checklist with explanations.

Quick version:
- [ ] manifest.json `version` bumped
- [ ] CHROMEWEBSTORE.md `Last Updated` date is current
- [ ] All descriptions are specific and accurate (no vague marketing)
- [ ] Single Purpose field is filled in and narrow
- [ ] Every permission has a justification
- [ ] host_permissions scoped as tightly as possible (not `<all_urls>` unless truly needed)
- [ ] Privacy & Data Use section matches actual data practices
- [ ] Privacy policy URL is live and accessible
- [ ] Store icon is 128×128 PNG
- [ ] At least 1 screenshot at correct dimensions
- [ ] No placeholder text or TODO items remain
- [ ] Version History has an entry for this release
- [ ] ZIP package contains only necessary files (no .git, node_modules, .env, etc.)
- [ ] Extension tested in Chrome with no console errors

## Store Listing Copy Guidelines

Good store listing copy is the difference between approval and rejection, and between
downloads and obscurity. Follow these principles:

1. **Lead with function, not feeling.** "Blocks ads on YouTube" not "Enjoy YouTube again"
2. **Be specific about what it does.** List concrete features, not abstract benefits
3. **Explain permissions in the description.** Users who see scary permissions without
   explanation will bounce. Pre-empt this.
4. **Include usage instructions.** "Click the extension icon → select text → click Save"
5. **No keyword stuffing.** The review team flags this
6. **Mention limitations honestly.** "Works on Chrome 120+ only" or "Does not work on
   chrome:// pages" builds trust

## Reference Files

| Topic | File |
|-------|------|
| CHROMEWEBSTORE.md template | `references/chromewebstore-template.md` |
| Privacy policy guidance | `references/privacy-policy.md` |
| Pre-publish review checklist | `references/review-checklist.md` |
| Store listing tips & rejections | `references/store-listing.md` |

Read the relevant reference file BEFORE generating content for that section.
