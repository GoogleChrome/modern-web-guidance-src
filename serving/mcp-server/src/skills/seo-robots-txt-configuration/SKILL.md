---
description: Ensures search engines can crawl public pages and avoid indexing unwanted content by correctly configuring the robots.txt file.
filename: robots-txt-configuration
category: seo
---

# Robots.txt Configuration

The `robots.txt` file is a crucial tool for webmasters to guide search engine crawlers. It specifies which parts of a website search engines are allowed or disallowed from crawling. Incorrect configuration can lead to search engines not indexing important pages or indexing content that should remain private.

## Best Practices for `robots.txt`

### 1. Ensure `robots.txt` Returns a 200 OK Status Code

A `robots.txt` file that returns an HTTP 5XX status code (server error) will prevent search engines from crawling any part of your site, as they cannot determine your crawling preferences.

- **DO** ensure your `robots.txt` file is accessible and returns a 200 OK status code.
- **DO** check the HTTP status code for `robots.txt` using browser developer tools.

### 2. Keep `robots.txt` File Size Under 500 KiB

Search engines may truncate processing of `robots.txt` if the file exceeds 500 KiB. This can lead to unpredictable crawling behavior.

- **DO** keep your `robots.txt` file concise.
- **DO** use broader patterns instead of disallowing individual files (e.g., `disallow: /*.pdf` instead of listing each PDF).

### 3. Correctly Format Directives

`robots.txt` has a specific syntax. Errors in formatting can lead to directives being ignored or misinterpreted.

- **DO** allow only empty lines, comments, and directives in the "name: value" format.
- **DO** ensure `allow` and `disallow` values are either empty or start with `/` or `*`.
- **DO** use `$` only at the end of a pattern.
- **DON'T** use invalid characters or syntax in directives.

### 4. Specify a `user-agent` for Every Set of Directives

The `user-agent` directive identifies the crawler to which the subsequent rules apply. Omitting it means the directives won't be associated with any crawler.

- **DO** provide a value for each `user-agent` directive.
- **DO** use `*` as a user-agent to apply directives to all crawlers not specifically listed.
- **DO** use specific user-agent names (e.g., `Googlebot`) to target particular crawlers.

```text
# Example of correct user-agent specification:
user-agent: *
disallow: /private/

user-agent: Googlebot
allow: /private/important-page/
```

### 5. Place Directives After `user-agent`

Directives like `allow` and `disallow` must appear within a `user-agent` block. Directives placed before the first `user-agent` will be ignored.

- **DO** ensure all `allow` and `disallow` directives are preceded by a `user-agent` directive.

```text
# Correct structure:
user-agent: *
disallow: /downloads/
```

```text
# Incorrect structure:
disallow: /downloads/
user-agent: *
```

### 6. Provide Absolute URLs for `sitemap` Directive

The `sitemap` directive points search engines to your sitemap file. It must be a fully qualified URL.

- **DO** provide an absolute URL (e.g., `https://example.com/sitemap.xml`) for the `sitemap` directive.
- **DON'T** use a relative URL (e.g., `/sitemap.xml`).

```text
# Correct:
sitemap: https://www.example.com/sitemap.xml

# Incorrect:
sitemap: /sitemap.xml
```

### 7. File Location

For `robots.txt` to be processed correctly by search engines, it must be located in the root directory of your website or subdomain.

- **DO** place your `robots.txt` file in the root of your domain (e.g., `https://example.com/robots.txt`).
- **DON'T** place `robots.txt` in subdirectories.

## Resources

- [Create a `robots.txt` file](https://support.google.com/webmasters/answer/6062596)
- [Robots.txt](https://moz.com/learn/seo/robotstxt)
- [Google crawlers (user agents)](https://support.google.com/webmasters/answer/1061943)