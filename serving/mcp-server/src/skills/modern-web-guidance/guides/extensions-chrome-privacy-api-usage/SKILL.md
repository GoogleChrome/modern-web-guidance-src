---
description: Controls Chrome's privacy-impacting features, such as network settings, service integrations, and website data exposure, using the ChromeSetting prototype.
filename: chrome-privacy-api-usage
category: extensions
---

# Controlling Chrome Privacy Settings

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/api/privacy
- https://developer.chrome.com/docs/extensions/reference/types/#ChromeSetting

## Best Practices

The `chrome.privacy` API allows extensions to control various privacy-related settings within Chrome. This API leverages the `ChromeSetting` prototype for getting and setting these configurations.

### Understanding Privacy Settings

The `chrome.privacy` API is organized into three main categories: `network`, `services`, and `websites`. Each category contains specific properties that can be modified.

#### Network Settings

These settings influence Chrome's general network connection behavior.

- **`network.networkPredictionEnabled`**: Controls whether Chrome pre-resolves DNS entries and opens TCP/SSL connections. Defaults to `true`.
- **`network.webRTCIPHandlingPolicy`**: Determines how WebRTC traffic is routed and local address information is exposed. Options include `"default"`, `"default_public_and_private_interfaces"`, `"default_public_interface_only"`, and `"disable_non_proxied_udp"`. Defaults to `"default"` (available Chrome 48+).

#### Service Integrations

These settings enable or disable features that rely on network services provided by Google or your default search provider.

- **`services.alternateErrorPagesEnabled`**: Controls whether Chrome uses a web service to resolve navigation errors. Defaults to `true`.
- **`services.autofillAddressEnabled`**: Enables or disables Chrome's offer to automatically fill in addresses. Defaults to `true` (available Chrome 70+).
- **`services.autofillCreditCardEnabled`**: Enables or disables Chrome's offer to automatically fill in credit card forms. Defaults to `true` (available Chrome 70+).
- **`services.passwordSavingEnabled`**: Controls whether the password manager prompts to save passwords. Defaults to `true`.
- **`services.safeBrowsingEnabled`**: Enables Chrome's protection against phishing and malware. Defaults to `true`.
- **`services.safeBrowsingExtendedReportingEnabled`**: Controls whether additional information is sent to Google when Safe Browsing blocks a page. Defaults to `false`.
- **`services.searchSuggestEnabled`**: Enables search suggestions in the Omnibox. Defaults to `true`.
- **`services.spellingServiceEnabled`**: Controls whether Chrome uses a web service for spell checking. Defaults to `false`.
- **`services.translationServiceEnabled`**: Enables Chrome's offer to translate pages. Defaults to `true`.

#### Website Data Exposure

These settings determine what information Chrome makes available to websites.

- **`websites.adMeasurementEnabled`**: Disables the Attribution Reporting API and Private Aggregation API. Defaults to `true` (available Chrome 111+). Extensions can only set this to `false`.
- **`websites.doNotTrackEnabled`**: Controls whether the 'Do Not Track' header is sent. Defaults to `false` (available Chrome 65+).
- **`websites.fledgeEnabled`**: Deactivates the Fledge API. Defaults to `true` (available Chrome 111+). Extensions can only set this to `false`.
- **`websites.hyperlinkAuditingEnabled`**: Enables auditing pings for `<a>` tags. Defaults to `true`.
- **`websites.protectedContentEnabled`**: (Windows and ChromeOS only) Enables a unique ID for plugins to run protected content. Defaults to `true`.
- **`websites.referrersEnabled`**: Controls whether `referer` headers are sent with requests. Defaults to `true`.
- **`websites.relatedWebsiteSetsEnabled`**: Deactivates Related Website Sets. Defaults to `true` (available Chrome 121+). Extensions can only set this to `false`.
- **`websites.thirdPartyCookiesAllowed`**: Controls whether third-party sites can set cookies. Defaults to `true`. Note that this setting has limitations in Incognito mode and with specific website exemptions.
- **`websites.topicsEnabled`**: Deactivates the Topics API. Defaults to `true` (available Chrome 111+). Extensions can only set this to `false`.

### Feature Detection and Polyfills

While the `chrome.privacy` API is a Chrome extension API, it's important to understand that direct browser feature detection for these specific privacy settings is not typically done in the same way as for web platform APIs. Extensions interact with the browser's internal settings through the provided API.

However, when dealing with related web platform features that might be influenced by these privacy settings (e.g., WebRTC), standard feature detection techniques for those specific web APIs should be employed.

For example, when considering WebRTC, you might use:

```javascript
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  // WebRTC is likely supported
} else {
  // Fallback or inform the user
}
```

When working with Chrome settings directly:

```javascript
chrome.privacy.websites.doNotTrackEnabled.get({}, function(details) {
  if (details.value) {
    console.log('Do Not Track is enabled.');
  } else {
    console.log('Do Not Track is disabled.');
  }
});

chrome.privacy.services.searchSuggestEnabled.set({ value: false }, function() {
  console.log('Search suggestions disabled.');
});
```

## Fallback Strategies

When developing extensions that interact with `chrome.privacy`, consider the following:

- **Browser Compatibility**: While the `chrome.privacy` API is specific to Chrome, be mindful of different Chrome versions and their support for specific features within the API. Use the provided version indicators in the documentation.
- **User Permissions**: Ensure your extension requests the necessary `privacy` permission in its `manifest.json`.
- **Default Values**: Understand the default values of each setting. Extensions should generally only modify settings that are necessary for their functionality and ideally provide users with an option to revert changes.
- **Incognito Mode**: Be aware that some settings, like `websites.thirdPartyCookiesAllowed`, behave differently or cannot be changed in Incognito mode.
- **Error Handling**: Implement robust error handling when setting privacy configurations, as certain operations might be disallowed or throw errors (e.g., trying to enable a disabled API that extensions can only disable).