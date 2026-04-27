---
name: write-store-listing
description: Write the name, short description, detailed description, and category fields for a Chrome Web Store listing.
web-feature-ids: []
---

# Write a Store Listing

Use this guide when creating or updating the store-facing copy for a Chrome extension.

## Required Fields

### Extension Name
Must match `manifest.json` `name` exactly. Max 75 characters. The name is your primary
identifier — make it descriptive and memorable, not generic ("Tab Manager" is weak;
"OneTab — Tab Groups & Saver" is better).

### Short Description (132 chars max)
Shown in search results, category pages, and install prompts. Rules:
- Start with the function, not the brand: "Highlights and saves text on any webpage" not "HighlightPro"
- Be specific. "Translates selected text into 50+ languages" beats "Translation tool"
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
