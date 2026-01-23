---
description: Audit and mitigate risks associated with integrating third-party resources into your website to protect user privacy.
filename: auditing-third-party-resources
category: security
---

# Auditing and Mitigating Third-Party Resource Risks

Integrating third-party resources can enhance website functionality but introduces potential security and privacy risks. This guide outlines how to audit these resources and implement best practices to protect user data and maintain trust.

## Understanding Third-Party Resources

Third-party content is defined as anything hosted on a shared, public origin and widely used across various sites, uninfluenced by an individual site owner. This includes images, fonts, scripts, and embedded media. While not essential for site development, they are almost ubiquitous.

For privacy, a key distinction is that a third-party resource is authored by someone other than the site owner. This authorship aspect is crucial when considering user privacy.

### Why Use Third-Party Resources?

*   **Reduced Development Load:** Offloads development and maintenance to the third-party provider.
*   **Enhanced Functionality:** Adds features and capabilities that might be complex or time-consuming to build in-house.
*   **Web Composability:** Leverages the web's ability to combine different components into a richer experience.

### Risks Associated with Third-Party Resources:

*   **Data Access:** Third parties can access information passed in HTTP requests, such as `Referer` headers and IP addresses.
*   **Cross-Site Tracking:** Allows third parties to log user activity across multiple websites that use the same resource.
*   **Sensitive Information Disclosure:** Scripts can potentially gather and transmit sensitive user data.
*   **Security Vulnerabilities:** Malicious third-party code (e.g., web skimmers) can steal data like credit card information.
*   **Reputational Damage:** If a third party misuses data or suffers a breach, users may perceive it as a failure of your service.

## Auditing Your Third Parties

A thorough audit is essential to understand the risks associated with the third-party resources you use. This involves both non-technical and technical approaches.

### Non-Technical Audit

1.  **Review Privacy Policies:** Read the privacy policies of your third-party suppliers. Assess if their data collection and usage practices align with your own and your users' expectations. If a policy contains anything you wouldn't state in your own, consider an alternative.
2.  **Identify Business Relationships:** Note third parties you have a financial or business relationship with (e.g., ad networks, analytics providers).

### Technical Audit

1.  **Simulate a New User:** Test your site using a clean browser profile (incognito/private browsing modes can also be used, but new profiles are preferred for comprehensive testing). Sign up for an account, interact with the site, and try to use it without disclosing unnecessary information or accepting all tracking cookies.
2.  **Utilize Browser Developer Tools:**
    *   Open the **Network** panel to view all outgoing HTTP requests.
    *   Group requests by type (HTML, CSS, JS, etc.).
    *   Add a "Domain" column to see all contacted domains.
    *   Use the "third-party requests" filter if available.
    *   Record network logs in a **HAR file** for detailed analysis.
3.  **Map Third-Party Dependencies:** Tools like Simon Hearne's "Request Map Generator" can provide an overview of requests. Be aware that third-party scripts often load additional third-party scripts, creating nested dependencies.
4.  **Match Business and Technical Lists:** Correlate the list of third parties identified through business relationships with those found in the technical audit. Investigate discrepancies (e.g., paid services not appearing in network requests).
5.  **Analyze Request Data:** Examine the data passed in individual third-party requests.

**DO** test your site as if you are a new user by creating a brand new browser profile each time and then discarding it. This provides the most accurate representation of a first-time visitor's experience.

## Implementing Privacy-Preserving Practices

Once you understand your third-party landscape, implement strategies to mitigate risks.

### Best Practices for Specific Integrations:

*   **Social Media Sharing Buttons:**
    *   Consider using plain HTML links or embedding HTML buttons directly (e.g., from [sharingbuttons.io](https://sharingbuttons.io/)).
    *   **Trade-off:** You may lose analytics data like share counts.
    *   **Alternative:** Provide links that direct users to the social media platform to initiate the share.
*   **Video Embedding:**
    *   Look for privacy-enhanced embedding options (e.g., `youtube-nocookie.com` for YouTube).
    *   **Alternative:** Replace embedded videos with links to the video provider's site.
    *   **Facade Pattern:** Dynamically replace embedded content with a placeholder (like a thumbnail) that requires user interaction to load the actual content. Utilize oEmbed where supported.
*   **Analytics Scripts:**
    *   Choose privacy-focused analytics services or self-hosted solutions (like Matomo) if feasible.
    *   **Mindset Shift:** Focus on collecting specific data to answer defined questions rather than gathering all available data.
    *   **Configuration:** Limit data collection, reduce storage duration, and enable privacy features (e.g., IP anonymization) offered by providers like Google Analytics.

### Build-Time Protections (HTTP Headers):

*   **`Referrer-Policy`:**
    *   **DO** set `strict-origin-when-cross-origin` or `noreferrer` to limit the amount of referrer information passed to third parties.
    *   **Why:** URLs can contain sensitive information; limiting this exposure protects user privacy. Modern browsers often default to `strict-origin-when-cross-origin`.
    *   **Implementation:** Use `<meta name="referrer" content="...">` in HTML or set the `referrerpolicy` attribute on specific elements.
*   **`Content-Security-Policy` (CSP):**
    *   Primarily a security measure against XSS, CSP can also limit where resources are loaded from.
    *   **`Content-Security-Policy-Report-Only`:** Use this header to get reports of policy violations without blocking requests. This is invaluable for ongoing audits, alerting you to unexpected third-party requests.
    *   **Implementation:** Configure a reporting URL and periodically review the collected data. Gradually refine the policy to include expected domains.
*   **`Permissions-Policy` (formerly Feature-Policy):**
    *   Restricts access to powerful browser features (camera, microphone, geolocation, etc.) for the main page and subframes.
    *   **DO** apply a restrictive policy by default and selectively allow features your site requires. Browsers often block powerful features in subframes by default.
    *   **Implementation:** Use a generator tool like [permissionspolicy.com](https://www.permissionspolicy.com/) to create a comprehensive restrictive policy.

## Browser-Built-In Privacy Features

Be aware of privacy features implemented by browsers, as they can affect your site's functionality:

*   **Intelligent Tracking Prevention (Safari):** Blocks third-party cookies by default, reduces referrer data, and limits `localStorage` duration.
*   **Enhanced Tracking Protection (Firefox):** Blocks trackers, fingerprinting scripts, and cryptominers by default. Implements "Total Cookie Protection" to isolate cookies per site.
*   **Chrome/Edge:** While third-party cookies are not blocked by default, users can enable this. Chrome is actively developing privacy-preserving APIs under the "Privacy Sandbox" initiative.

**DO** test your site in various browser privacy modes and with upcoming browser versions to understand potential impacts.

## Emerging API Proposals

The phasing out of third-party cookies necessitates new APIs designed for privacy-preserving use cases (e.g., identity, advertising, fraud detection). Examples include FedCM, Private Click Measurement, Attribution Reporting, Topics, and Trust Tokens. While you may not need to use these directly unless your product relies heavily on third-party cookies, staying informed about their development is beneficial.

**DO** stay updated on proposals and experiments in the privacy space, such as those listed by the Privacy Group on Github.