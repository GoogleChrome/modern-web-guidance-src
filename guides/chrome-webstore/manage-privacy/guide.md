# Manage Privacy and Data Disclosure

Use this guide when completing the privacy disclosure on the developer dashboard or writing
a privacy policy. Mismatches between your disclosure form, privacy policy, and actual
extension behavior are a common rejection trigger.

## When a Privacy Policy is Required

A privacy policy URL is **required** if the extension:
- Handles personal or sensitive user data (financial, health, personal communications, location)
- Uses any of these permissions: `identity`, `cookies`, `webRequest`, `browsingData`, `history`,
  `bookmarks`, `topSites`, or `<all_urls>` host permission
- Collects analytics or telemetry of any kind
- Transmits any data off the user's device

A privacy policy is **recommended** for all extensions — even those that collect no data.
It signals professionalism and prevents delays if a reviewer flags the omission.

## Completing the Data Disclosure Form

In the developer dashboard, you declare how your extension uses data. Fill the
Privacy & Data Use section of `CHROMEWEBSTORE.md` to prepare your answers.

**Common trap — `chrome.storage.sync`:** If you use `chrome.storage.sync`, data is
transmitted to Google's servers. This counts as off-device transmission. You must
disclose it as transmitted data even if you're not sending it to your own servers.

**Common trap — error reporting:** If you use any error reporting service (Sentry, Bugsnag,
self-hosted), the error payloads may include page URLs or user identifiers. Declare this.

**Common trap — analytics:** Any analytics library (even minimal event tracking) must be
declared. Name the service.

The three data use certifications you must be able to check:
- Data is NOT sold to third parties
- Data is NOT used for purposes unrelated to the extension's core functionality
- Data is NOT used for creditworthiness or lending purposes

## Where to Host the Privacy Policy

Must be at a publicly accessible URL — not behind a login wall:
- **GitHub Pages** — free, stable URL, version-controlled
- **GitHub Gist** — quick; use the raw URL
- **Your project website** — add a `/privacy` page
- **Notion / Google Sites** — free hosted pages

The review team visits the URL. A 404 is an automatic rejection.

## Privacy Policy Templates

### Minimal Policy (No Data Collection)

Use this if the extension stores nothing and makes no network calls:

```
Privacy Policy for [Extension Name]

Last updated: [Date]

[Extension Name] does not collect, store, or transmit any personal data or
browsing information. All data stays on your device.

This extension does not use cookies, analytics, or third-party services.

For questions, contact [email].
```

### Standard Policy (Local Storage Only)

Use this if the extension uses `chrome.storage.local` for preferences but sends
nothing off-device:

```
Privacy Policy for [Extension Name]

Last updated: [Date]

## Data Storage

[Extension Name] stores your preferences ([list: e.g., "theme selection, saved highlights"])
locally on your device using Chrome's built-in storage. This data never leaves your device
and is not accessible to us.

## Data Collection

We do not collect any personal information, usage data, or analytics.

## Third-Party Services

This extension does not use any third-party services.

## Data Deletion

You can delete all stored data by uninstalling the extension, or by using the
"Clear Data" button in [Settings / Options page].

## Contact

For questions about this policy, contact [email].
```

### Standard Policy (With Cloud Sync or API)

Use this if the extension transmits data to your servers or a third-party API:

```
Privacy Policy for [Extension Name]

Last updated: [Date]

## What Data We Collect

[List each data type and the feature that uses it.]
Example: "Your saved items list is synced to our servers so you can access
it across devices."

## How Data Is Stored

[Describe: local only, chrome.storage.sync (Google servers), or your own servers.]

## How Data Is Used

[Tie each data type to a specific feature. No vague "to improve your experience".]

## Third-Party Services

[Name each service and link to their privacy policy.
Example: "We use Sentry for error reporting: https://sentry.io/privacy/"]
If none: "This extension does not use any third-party services."

## Data Sharing

We do not sell or share your data with third parties.
[OR: "We share [data type] with [party] for [specific reason]."]

## Data Retention and Deletion

[How long data is kept. How to delete it: uninstall, clear button, account deletion.]

## Changes to This Policy

We will update this policy if our data practices change and notify users via
[email / in-extension notice / Chrome Web Store listing update].

## Contact

[Email or support URL]
```

## Common Mistakes That Cause Rejection

- **Policy contradicts disclosure form**: If the dashboard form says "no data collected" but
  the policy mentions analytics — rejected.
- **Too vague**: "We may collect some data" — rejected. Be specific about what.
- **Dead link**: The URL returns 404 — automatic rejection. Check it before submitting.
- **Missing data types**: Forgot to disclose `chrome.storage.sync` or external API calls.
- **No contact info**: CWS requires a way for users to reach you about privacy concerns.
