---
description: Track user engagement and advertising performance for your Chrome Web Store listing using Google Analytics.
filename: track-webstore-analytics
category: extensions
---

# Monitoring Chrome Web Store Performance with Google Analytics

The Chrome Web Store integrates with Google Analytics, allowing you to gain deeper insights into your extension's performance beyond the basic metrics available in the Developer Dashboard. This guide outlines how to set up and leverage this integration for tracking user behavior and advertising effectiveness.

## Opting In to Google Analytics

To begin, navigate to your extension's page in the [Developer Dashboard][developer-dashboard]. Under the "Additional metrics" section on the Store listing page, click "Opt in to Google Analytics."

<figure>
  <img src="image/opt-ui-google-analytics-607e706bd69c9.png" alt="Opt in UI for Google Analytics in Developer Dashboard" width="800" height="161">
  <figcaption class="dcc-caption">Opt in UI for Google Analytics in Developer Dashboard.</figcaption>
</figure>

After opting in, a new property will appear in your Google Analytics account, typically named with your extension's ID.

## Understanding Data Limits

Be aware of the following limitations within your Google Analytics property:

*   **Data Retention:** Data is retained for two months.
*   **Data De-identification:** To protect user privacy, data de-identification is enabled. This means access to non-aggregated data is restricted, and data may be withheld if it doesn't meet system-defined [thresholds][ga-thresholds].
*   **User Access:** Additional users can only be granted access by syncing with a Group Publisher (refer to [Giving other accounts access](#group-publisher)).

## Key Metrics and Events

### Page Views

Each visit to your extension's listing generates a `page_view` event for the following URL format:
`/webstore/detail/ext/free/EXTENSION_ID/EXTENSION_NAME`

### Events

The Chrome Web Store also sends several standard and custom events to your Google Analytics property:

*   **Standard Events:** `page_view`, `session_start`, `first_visit`, and `user_engagement` are automatically tracked.
*   **Custom Event (`install`):** A custom event is sent when a user successfully installs your extension, contingent on them accepting the permission prompt.

## Monitoring Ad Performance with UTM Parameters

A common use case is to track the effectiveness of your marketing campaigns. You can use UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`) in your extension's URLs to attribute traffic and conversions.

For example, a link like this:
[https://chrome.google.com/webstore/detail/action-api-demo/ljjhjaakmncibonnjpaoglbhcjeolhkk?utm_source=ad&utm_medium=cpc&utm_campaign=summer-ad-campaign](https://chrome.google.com/webstore/detail/action-api-demo/ljjhjaakmncibonnjpaoglbhcjeolhkk?utm_source=ad&utm_medium=cpc&utm_campaign=summer-ad-campaign)

Will result in the following for associated `page_view` and `install` events:

*   Session source: `ad`
*   Session medium: `cpc`
*   Session campaign: `summer-ad-campaign`

If it's the user's first visit, these values will also be reflected in the "first user source," "first user medium," and "first user campaign" fields.

<aside class="note"><b>Note:</b> Data finalization can take 24 to 48 hours. During this period, you might observe blank entries for UTM-related fields, which will be corrected as the data matures.</aside>

### Connecting to Other Advertising Services

Currently, direct linking of your Google Analytics property to services like Google Ads is not supported. It's recommended to regularly review your Google Analytics data to assess ad performance and inform campaign optimization strategies.

## Tracking Conversions

To treat extension installs as valuable conversions, you can configure the `install` event within Google Analytics. Navigate to **Admin**, then **Conversions**, and select **New Conversion Event**. Enter "install" and click **Save**. The install event will then be prominently displayed as a conversion on your Google Analytics dashboard.

## Granting Access to Other Accounts

### Using a Group Publisher

To provide access to your Google Analytics property for other Google accounts, establish a [Group Publisher][group-publisher]. Members of this group will automatically inherit access. Be mindful that granting access through a group publisher also allows these users to manage your extension in the Developer Dashboard. Therefore, share this access judiciously.

### With Looker Studio

Alternatively, you can use [Looker Studio][looker-studio] to create shareable reports based on your Google Analytics data.

1.  Click "Create" and select your desired file type.
2.  Choose the Google Analytics connector.
3.  Add your property under the "Chrome Web Store developer properties" account.

This method allows you to easily share insights with any Google account without granting direct administrative access to your analytics.

[developer-dashboard]: https://chrome.google.com/webstore/devconsole/
[ga]: https://analytics.google.com/
[ga-thresholds]: https://support.google.com/analytics/answer/9383630
[ga-pageview]: https://support.google.com/analytics/answer/9234069#page_view
[ga-sessionstart]: https://support.google.com/analytics/answer/9234069#session_start
[ga-firstvisit]: https://support.google.com/analytics/answer/9234069#first_visit
[ga-userengagement]: https://support.google.com/analytics/answer/9234069#user_engagement
[ga-custom-events]: https://support.google.com/analytics/answer/12229021
[extensions-ga4]: /docs/extensions/mv3/tut_analytics/
[group-publisher]: /docs/webstore/group-publishers/
[looker-studio]: https://lookerstudio.google.com/