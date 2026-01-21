---
description: Ensure your web pages have a clear and concise meta description to improve search engine visibility and user click-through rates.
filename: meta-description-best-practices
category: seo
---

# Meta Descriptions

A meta description provides a summary of a page's content, which search engines often display in search results. A well-crafted, unique meta description can make your page appear more relevant to user queries and potentially increase organic traffic.

## How the Lighthouse Meta Description Audit Fails

The Lighthouse audit flags pages that are missing a meta description or have an empty one.

<figure class="w-figure">
  <img src="image/lighthouse-audit-showing-bb9b6ba4a536e.png" alt="Lighthouse audit showing the document doesn't have a meta description" width="800" height="74">
</figure>

The audit fails if:

- Your page does not have a `<meta name="description">` element.
- The `content` attribute of the `<meta name="description">` element is empty.

Lighthouse does not evaluate the quality of your description content.

## How to Add a Meta Description

Include a `<meta name="description">` element within the `<head>` section of each of your HTML pages:

```html
<meta name="description" content="This is a concise and informative summary of your page's content.">
```

If relevant, you can include structured data within your descriptions, such as:

```html
<meta name="description" content="Author: Jane Doe,
    Publication Date: 2023-10-27, Category: Technology,
    Price: Free">
```

## Meta Description Best Practices

-   **Uniqueness:** Ensure each page has a distinct meta description that accurately reflects its content.
-   **Clarity and Conciseness:** Write descriptions that are easy to understand and to the point. Avoid generic phrases like "Home" or "Welcome."
-   **Avoid Keyword Stuffing:** Do not overload your description with keywords, as this can harm your SEO and user experience, potentially being flagged as spam.
-   **Descriptive, Not Just Keywords:** While keywords are important, focus on creating a compelling summary that entices users to click.
-   **Structured Data (Optional):** Consider including structured data if it provides valuable, scannable information for users and search engines.

Here are examples of effective and ineffective meta descriptions:

<div class="dcc-compare">
  <div class="compare-worse">Don't</div>
  <pre class="prettyprint lang-html">{% htmlescape %}<meta name="description" content="A blog about dogs.">
{% endhtmlescape %}</pre>
<div class="dcc-caption"><p>Too vague and uninformative.</p>
</div>
</div>

<div class="dcc-compare">
  <div class="compare-better">Do</div>
  <pre class="prettyprint lang-html">{% htmlescape %}<meta
  name="description"
  content="Explore our comprehensive blog on dog care, training tips, and breed spotlights. Get expert advice for happy and healthy canine companions.">
{% endhtmlescape %}</pre>
<div class="dcc-caption"><p>Specific, engaging, and includes relevant keywords.</p>
</div>
</div>

For more detailed guidance, refer to Google's recommendations on creating effective titles and snippets.

## Resources

-   [Source code for **Document does not have a meta description** audit](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/seo/meta-description.js)
-   [Create good titles and snippets in Search Results](https://developers.google.com/search/docs/appearance/title-link)
-   [Irrelevant keywords](https://developers.google.com/search/docs/advanced/guidelines/keyword-insertion)