---
name: handle-rejection
description: Fix and resubmit a Chrome extension rejected by the Web Store review team.
web-feature-ids: []
---

# Handle a Rejection

Use this guide when an extension has been rejected by the Chrome Web Store review team.

## Immediate Steps

1. Read the rejection email carefully — it identifies the specific policy violated
2. Record the rejection in `CHROMEWEBSTORE.md` under Rejection History:
   ```
   | Date | Reason | Fix Applied | Resubmitted |
   |------|--------|-------------|-------------|
   | YYYY-MM-DD | [Policy/reason] | [What you changed] | |
   ```
3. Make the fix (see common reasons below)
4. Re-run the pre-publish checklist from `guides/package-and-submit.md`
5. Resubmit

**Note:** Repeated policy violations can result in account suspension. Take rejections
seriously and fix root causes, not just the specific symptom.

## Appealing a Decision

As of April 2026, you can appeal a policy enforcement decision directly from the
Chrome Web Store Developer Dashboard. Use this if you believe the rejection was incorrect
or if you've made changes and want to provide context to the review team.

## Common Rejection Reasons and Fixes

### Excessive Permissions
**Symptom:** "Your extension requests more permissions than it needs."

Fix:
- Replace `<all_urls>` with specific host patterns where possible
- Replace `tabs` with `activeTab` if you only need the current tab on user click
- Remove any permissions left over from features you removed
- Audit every permission: if you can't write a specific justification, remove it

---

### Missing or Vague Single Purpose
**Symptom:** "Your item does not have a single, clear purpose."

Fix:
- Rewrite the single purpose field to be narrow: "Saves highlighted text from web pages
  to a local reading list" not "Productivity tool"
- If the extension does too many unrelated things, consider splitting it into multiple
  focused extensions

---

### Misleading Description or Functionality
**Symptom:** "Your extension does not provide the functionality described."

Fix:
- Remove descriptions of features that don't work yet
- Test every feature listed in the description before resubmitting
- Remove superlatives ("the best", "the fastest") unless verifiable

---

### Privacy Policy Issues
**Symptom:** "Your extension requires a privacy policy." or "Your privacy policy URL is not accessible."

Fix:
- Host the privacy policy at a stable, public URL (see `guides/manage-privacy.md`)
- Visit the URL yourself to confirm it loads
- Ensure the policy text covers all data the extension actually collects
- Ensure the policy is consistent with the dashboard disclosure form

---

### Data Disclosure Mismatch
**Symptom:** "Your extension's data usage does not match your disclosure."

Fix:
- Audit every `fetch()`, `XMLHttpRequest`, and `chrome.storage.sync` call
- `chrome.storage.sync` transmits data to Google's servers — disclose it
- If you use any analytics or error reporting service, declare it by name
- Align the disclosure form and privacy policy so they say the same thing

---

### Trademark Violation
**Symptom:** "Your extension uses trademarked content without authorization."

Fix:
- Remove other companies' brand names from the extension name and icon
- Replace brand-specific language with generic terms ("Video Downloader" not "YouTube Downloader")
- Remove any logo or brand color that implies affiliation with another company

---

### Obfuscated Code
**Symptom:** "Your extension contains obfuscated code."

Fix:
- Minification is allowed; obfuscation is not
- If using a bundler (webpack, rollup, vite), ensure output is minified but readable
- Remove any string encoding tricks or intentionally unreadable code patterns

---

### Remote Code Execution
**Symptom:** "Your extension executes remotely hosted code."

Fix:
- Bundle all JavaScript in the extension package
- Do not load scripts from CDNs at runtime (`<script src="https://...">` in extension pages)
- Do not use `eval()` or `new Function()` with content fetched from a remote URL
- Fetching JSON data from APIs is fine; fetching and executing JavaScript is not

---

### Minimum Functionality
**Symptom:** "Your extension does not have enough functionality to be listed."

Fix:
- The extension must provide genuine value beyond what the browser offers natively
- Extensions that only open a URL, install another app, or wrap a website without adding
  features are not eligible
- Add a meaningful user-facing feature before resubmitting

---

### Blank Description / Missing Assets
**Symptom:** Auto-rejected without specific feedback.

Fix:
- Verify the detailed description field is filled in and not a placeholder
- Confirm the store icon (128×128 PNG) is uploaded
- Confirm at least one screenshot at the correct dimensions is uploaded

## Review Timeline

- New extensions: typically 1–3 business days, sometimes longer
- Updates to existing extensions: often within 24 hours
- After resubmitting a rejected extension: similar to update timeline
- No official expedited review; maintaining a clean track record helps
