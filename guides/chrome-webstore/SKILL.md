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
update (or create) `CHROMEWEBSTORE.md` in the project root.

### When to create CHROMEWEBSTORE.md

Create it the moment any of these happen:
- The user says they want to publish an extension
- The user asks to "prepare for the store" or "get ready to publish"
- You're building a new extension that will clearly end up on the store
- The user asks about store listing requirements

Use the template below. To fill it out:

1. Read `manifest.json` to extract name, version, description, permissions, host_permissions
2. Scan the codebase for data collection (storage, fetch calls, analytics)
3. Check for icon files and their dimensions
4. Look at the extension's UI to understand features for the description

### When to update CHROMEWEBSTORE.md

- **User-facing changes**: Bump "Last Updated", update the feature list, add a Version History entry
- **manifest.json changes**: If permissions, host_permissions, or content_scripts changed,
  update the Permissions Justification section
- **New release**: Add a Version History entry with version, date, and summary
- **Privacy-relevant changes**: If data collection, storage, or transmission changed,
  update Privacy & Data Use and the privacy policy
- **Asset changes**: Note which screenshots need refreshing
- **Rejection**: Update the file with the fix and add a note to Rejection History

## Store Listing Fields

### Extension Name
Must match `manifest.json` `name` exactly. Max 75 characters. Make it descriptive and
memorable, not generic ("Tab Manager" is weak; "OneTab — Tab Groups & Saver" is better).

### Short Description (132 chars max)
Shown in search results, category pages, and install prompts:
- Start with the function, not the brand: "Highlights and saves text on any webpage" not "HighlightPro"
- Be specific: "Translates selected text into 50+ languages" beats "Translation tool"
- No "Chrome extension" — the user already knows
- Include the primary keyword naturally

**Good:** "Save articles to read later with one click. Works offline."
**Bad:** "The best productivity tool for Chrome!" (vague, marketing-speak)

### Detailed Description (16,000 chars max)
CWS strips all markdown. Use plain text with line breaks only. Structure that passes review:

```
[One sentence: exactly what this extension does]

FEATURES
• Feature 1 — brief explanation of what it does
• Feature 2 — brief explanation
• Feature 3 — brief explanation

HOW TO USE
1. Click the extension icon in the toolbar
2. [Next step]
3. [Next step]

PRIVACY
This extension does not collect any personal data. Your [data] is stored locally
on your device and never transmitted to any server.

PERMISSIONS
• "Read and change data on sites you visit" — needed to [specific feature].
  The extension only activates when you [trigger action].

SUPPORT
Found a bug? Have a suggestion? Email [email] or open an issue at [URL].

Version [X.Y.Z] — [Brief changelog for latest version]
```

Why this structure passes review:
- **One-sentence opener**: The reviewer scans the first line. If it's vague, it gets flagged.
- **Features list**: Plain-text bullets (•) render correctly in the store.
- **Permissions section**: Pre-empts user concerns about scary permission warnings during install.
- **Support info**: Required by CWS policy ("meaningful customer support").

### Category
Pick the closest match:
Accessibility, Blogging, Developer Tools, Fun, News & Weather,
Photos, Productivity, Search Tools, Shopping, Social & Communication, Sports

### Single Purpose Statement
Filled in the developer dashboard Privacy tab — not shown to users, but read carefully by
the review team. Must be one narrow, specific sentence.

**Approved:** "Saves highlighted text from web pages to a local reading list"
**Rejected:** "Improves your browsing experience" (too vague)
**Rejected:** "Highlights text, saves bookmarks, manages tabs, and blocks ads" (not single purpose)

If the extension does multiple things, focus on the primary function. Secondary features
belong in the detailed description, not the single purpose field.

### Primary Language
The language of the extension's UI and description (e.g., "English").

## What Triggers Rejection

- **Blank description field**: Auto-rejected
- **Missing icon or screenshots**: Auto-rejected
- **Misleading claims**: Any feature listed that doesn't actually work
- **Keyword spam**: Repeating keywords 5+ times, unattributed testimonials, irrelevant keywords
- **Vague single purpose**: "Productivity tool" or "Makes browsing better"
- **No meaningful functionality**: Extensions that only install another app or wrap a website
  without adding value are ineligible

## CHROMEWEBSTORE.md Template

Copy this into the project root as `CHROMEWEBSTORE.md`:

```markdown
# Chrome Web Store Listing — [Extension Name]

> Last Updated: YYYY-MM-DD

## Store Listing

**Extension Name** [REQUIRED]
<!-- Must match manifest.json "name". Max 75 characters. -->


**Short Description** [REQUIRED]
<!-- Max 132 characters. Shown in search results and tiles. Be specific about function. -->


**Detailed Description** [REQUIRED]
<!-- Max 16,000 characters. Use plain text — CWS strips markdown.
     Structure: one-sentence opener → FEATURES → HOW TO USE → PRIVACY → PERMISSIONS → SUPPORT -->


**Category** [REQUIRED]
<!-- Accessibility | Blogging | Developer Tools | Fun | News & Weather |
     Photos | Productivity | Search Tools | Shopping | Social & Communication | Sports -->


**Single Purpose** [REQUIRED]
<!-- One narrow sentence for the developer dashboard Privacy tab.
     Good: "Highlights and saves text selections on web pages"
     Bad:  "Productivity tool that helps you work better" -->


**Primary Language** [REQUIRED]


## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ⬜ Not created | |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 4 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 5 | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

<!-- Status: ⬜ Not created | 🟡 Needs update | ✅ Ready -->


## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| | permissions | |
| | host_permissions | |


## Privacy & Data Use

**Does the extension collect user data?** Yes / No

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | | | | |
| Health info | | | | |
| Financial info | | | | |
| Authentication info | | | | |
| Personal communications | | | | |
| Location | | | | |
| Web history | | | | |
| User activity | | | | |
| Website content | | | | |

- [ ] Data is NOT sold to third parties
- [ ] Data is NOT used for purposes unrelated to the extension's core functionality
- [ ] Data is NOT used for creditworthiness or lending purposes


## Privacy Policy

**Privacy Policy URL** [REQUIRED if collecting data, RECOMMENDED otherwise]


## Distribution

**Visibility**: Public / Unlisted / Private
**Regions**: All regions / [List specific regions]
**Pricing**: Free / Paid


## Developer Info

**Publisher Name** [REQUIRED]

**Contact Email** [REQUIRED]
<!-- Displayed publicly. Google sends takedown/policy notices here — monitor it. -->

**Support URL / Email** [RECOMMENDED]

**Homepage URL** [RECOMMENDED]


## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| | | | Draft |

<!-- Status: Draft | Submitted | In Review | Published | Rejected -->


## Review Notes

### Known Issues / Limitations

### Rejection History
<!-- | Date | Reason | Fix Applied | Resubmitted | -->
```

## Quick Pre-Publish Checklist

Before submitting, verify:
- [ ] `manifest.json` `version` bumped
- [ ] CHROMEWEBSTORE.md "Last Updated" date is current
- [ ] All descriptions are specific and accurate (no vague marketing)
- [ ] Single Purpose field is filled in and narrow
- [ ] Every permission has a justification
- [ ] `host_permissions` scoped as tightly as possible
- [ ] Privacy & Data Use section matches actual data practices
- [ ] Privacy policy URL is live and accessible
- [ ] Store icon is 128×128 PNG
- [ ] At least 1 screenshot at correct dimensions
- [ ] No placeholder text or TODO items remain
- [ ] Version History has an entry for this release
- [ ] ZIP contains only necessary files
- [ ] Extension tested in Chrome with no console errors
- [ ] 2-Step Verification enabled on the developer account

See `guides/package-and-submit.md` for the full checklist with explanations.

