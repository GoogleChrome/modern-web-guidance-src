# Justify Permissions

Insufficient permission justifications are the most common reason for first-submission rejection.
The Chrome Web Store review team reads justifications for every permission in `manifest.json`.

## The Rule

For every entry in `permissions` and `host_permissions`, write a justification that:
1. Names the specific user-facing feature that uses the permission
2. Explains **when** the permission is invoked (not "needed for the extension to work")
3. Is specific enough that a reviewer who doesn't know your code can understand it

**Rejected:** "Required for functionality"
**Rejected:** "Used by the extension"
**Accepted:** "Reads page content only when the user clicks the Summarize button to generate a page summary"

## Minimum Permissions Requirement

Extensions must request only the narrowest permissions necessary. The review team checks
that every declared permission is actually used. Unused permissions cause rejection.
"Future-proofing" with permissions you might use later is explicitly prohibited.

## Common Permissions and How to Justify Them

| Permission | Weak (will be rejected) | Strong (passes review) |
|------------|------------------------|------------------------|
| `storage` | "Stores data" | "Saves user preferences (theme, font size) locally so settings persist across browser sessions" |
| `activeTab` | "Accesses the current tab" | "Reads the text content of the current page only when the user clicks the extension icon — no background access" |
| `tabs` | "Manages tabs" | "Reads tab titles and URLs to display a list of open tabs in the extension popup for tab management" |
| `scripting` | "Injects scripts" | "Injects a content script to highlight search terms on the page when the user activates the extension" |
| `contextMenus` | "Adds menu items" | "Adds a right-click menu item that saves the selected text to the user's reading list" |
| `notifications` | "Shows notifications" | "Displays a desktop notification when a tracked price drops below the user's saved threshold" |
| `alarms` | "Uses alarms" | "Checks for price updates every hour via chrome.alarms so the service worker can run reliably" |
| `bookmarks` | "Manages bookmarks" | "Reads and writes the user's bookmark list to sync it with the extension's tag-based organization system" |
| `history` | "Reads history" | "Reads the last 30 days of browsing history to generate a reading time report — history data never leaves the device" |
| `identity` | "Authenticates users" | "Uses chrome.identity to authenticate the user with Google OAuth so they can sync their data across devices" |
| `cookies` | "Reads cookies" | "Reads authentication cookies for example.com to verify the user is logged in before showing account-specific data" |
| `downloads` | "Handles downloads" | "Triggers a file download of the user's exported notes as a Markdown file when they click Export" |
| `webRequest` | "Intercepts requests" | "Intercepts requests to tracking domains and blocks them before they reach the network — no data is stored" |
| `declarativeNetRequest` | "Blocks requests" | "Blocks ad and tracker requests using a static ruleset bundled in the extension — no dynamic rule evaluation" |

## Host Permissions

Host permissions (`host_permissions`) need the same specificity. Additionally:
- Prefer specific domains over `<all_urls>` — the review team treats `<all_urls>` as a red flag
- If you need `<all_urls>`, explain exactly which feature operates on arbitrary sites and why

| Pattern | Acceptable justification |
|---------|--------------------------|
| `https://api.example.com/*` | "Sends the user's saved items to the example.com API for cross-device sync" |
| `*://*.example.com/*` | "Injects a content script on all example.com pages to add a save button to product listings" |
| `<all_urls>` | "Injects a page-action button on all websites so users can save any page to their reading list — the button is inactive until clicked" |

## Filling In CHROMEWEBSTORE.md

In the Permissions Justification section, list every permission:

```markdown
| Permission | Type | Justification |
|------------|------|---------------|
| storage | permissions | Saves user's highlight list and preferences locally |
| activeTab | permissions | Reads page text only when user clicks the extension icon to generate a summary |
| scripting | permissions | Injects highlight overlay into the page when user activates highlighting mode |
| https://api.example.com/* | host_permissions | Syncs user data with the example.com API for cross-device access |
```

Leave no row empty. If you can't write a specific justification for a permission, that's a
sign the permission isn't needed and should be removed from `manifest.json`.
