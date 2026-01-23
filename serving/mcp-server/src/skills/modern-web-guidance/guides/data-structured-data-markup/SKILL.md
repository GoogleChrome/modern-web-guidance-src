---
description: Use structured data to help search engines understand and richly display your content in search results.
filename: structured-data-markup
category: data
---

# Structured Data Markup

Structured data helps search engines understand the content of your page, increasing the likelihood of it appearing in rich search results.

## Best Practices

1.  **Identify Content Type:** Determine the type of content your page represents (e.g., article, product, FAQ). Refer to Google's [content types](https://developers.google.com/search/docs/guides/mark-up-content#content_types) documentation.
2.  **Create Markup:** Generate structured data markup according to the [reference documentation](https://developers.google.com/search/docs/guides/search-gallery) for your identified content type.
3.  **Insert Markup:** Add the generated markup to each page you want search engines to understand.
4.  **Validate Markup:** Use the [Structured Data Linter](http://linter.structured-data.org/) to check your structured data for errors.
5.  **Test in Search:** Utilize the [Structured Data Testing Tool](https://search.google.com/structured-data/testing-tool/) to see how your markup will appear in Google Search.

For comprehensive guidance, consult Google's [Mark Up Your Content Items](https://developers.google.com/search/docs/guides/mark-up-content) page.

**Note:** While the Lighthouse "Structured data is valid" audit is manual and does not impact your Lighthouse SEO score, implementing structured data correctly is crucial for search engine visibility and rich result eligibility.

## Resources

*   [Source code for "Structured data is valid" audit](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/seo/manual/structured-data.js)
*   [Mark Up Your Content Items](https://developers.google.com/search/docs/guides/mark-up-content)
*   [Structured Data Testing Tool](https://search.google.com/structured-data/testing-tool/)
*   [Structured Data Linter](http://linter.structured-data.org/)
*   [Google search gallery](https://developers.google.com/search/docs/guides/search-gallery)