---
description: Allow developers to skip the review process for eligible changes to Manifest V3 extensions using the Declarative Net Request API.
filename: skip-review-for-mv3-extensions
category: extensions
---

# Skip review for eligible changes to extensions

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
- https://developer.chrome.com/docs/webstore/skip-review
- https://developer.chrome.com/docs/webstore/api

## Use Case

Developers of Manifest V3 content filtering extensions can now skip the review process for eligible changes to their filter lists. This change leverages the Declarative Net Request API to allow for faster updates to extensions that rely on frequently changing filter lists.

## How to Qualify

Updates to [safe static rules][safe-rules] within your extension can be published without a full review. These changes go live within minutes of submission. Refer to the [skip review for eligible changes documentation][skip-review] for detailed eligibility criteria.

## Workflow

When submitting an update through the Developer Dashboard, you will see an option to request to skip review before confirming.

<figure>
  <img src="image/opt-in.png" alt="Submit for review dialog in the Developer Dashboard" width="600">
  <figcaption>"Submit for review" dialog in the Developer Dashboard</figcaption>
</figure>

The system will verify if your submission qualifies for the expedited review. If any ineligible changes are detected, you will be notified and given the option to proceed with a standard review.

<figure>
  <img src="image/not-eligible-warning.png" alt="Warning for non-eligible submissions" width="600">
  <figcaption>Warning for non-eligible submissions</figcaption>
</figure>

This skip-review functionality is also available when publishing updates via the [Chrome Web Store API][api].

## Best Practices

- **Ensure your updates strictly adhere to the criteria for safe static rules.** Ineligible changes will trigger a standard review process.
- **Utilize the Developer Dashboard or the Chrome Web Store API for submitting changes.** Both provide clear options for requesting to skip review.
- **Stay informed about the latest eligibility requirements.** Refer to the official documentation for any updates to the skip-review program.

[dnr]: /docs/extensions/reference/api/declarativeNetRequest
[safe-rules]: /docs/extensions/reference/api/declarativeNetRequest#safe_rules
[skip-review]: /docs/webstore/skip-review
[api]: /docs/webstore/api#publish