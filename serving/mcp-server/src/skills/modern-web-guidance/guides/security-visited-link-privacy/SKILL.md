---
description: Mitigate privacy leaks and prevent cross-site tracking by partitioning visited link history.
filename: visited-link-privacy
category: security
---

# Preventing `:visited` Link Privacy Leaks

Reference docs:
- https://developer.mozilla.org/docs/Web/CSS/:visited
- https://developer.mozilla.org/docs/Glossary/Site
- https://developer.mozilla.org/docs/Glossary/Origin

## Best Practices

To prevent privacy leaks and cross-site tracking, Chrome 136+ now partitions `:visited` link history. This means a link is only considered `:visited` if it was clicked from the same top-level site and frame origin.

### Partitioning `:visited` History

Historically, `:visited` history was unpartitioned, allowing any site to potentially track which links a user had visited, regardless of where the click originated. This enabled security exploits to reveal browsing activity.

**DO** leverage the `:visited` CSS selector to style links that users have previously interacted with to enhance user experience.

**DO NOT** rely on unpartitioned `:visited` history for user tracking or to infer browsing habits, as this poses a significant privacy risk.

### Understanding Partitioning

With partitioning, the browser stores visited link information based on the context of the click. This includes:
- **Link URL:** The specific address of the linked page.
- **Top-level site:** The domain from which the link was clicked.
- **Frame origin:** The origin of the frame in which the link was clicked (if applicable).

This approach ensures that a link is only styled as `:visited` if the combination of these factors matches a previously recorded visit.

### Handling Self-Links

To improve user experience on sites with internal navigation, a "self-links" carveout allows pages to display links to their own subpages as `:visited`, even if they weren't clicked from that exact context.

**DO** allow links to your site's own subpages to be styled as `:visited` to maintain a good user experience.

**DO NOT** assume that the self-links carveout compromises overall privacy. It does not enable new information leakage for cross-site tracking, as sites already have other means to track internal navigation.

## Implementation Status

These privacy enhancements are available in Chrome Version 136 and later.

## Further Information and Feedback

- [Original proposal](https://github.com/explainers-by-googlers/Partitioning-visited-links-history)
- [Raise questions and participate in discussions](https://github.com/explainers-by-googlers/Partitioning-visited-links-history/issues)
- [File a bug in the Chromium tracker](https://issues.chromium.org/u/2/issues?q=customfield1222907:%22Blink%3EHistory%3EVisitedLinks%22) if you encounter unexpected behavior.