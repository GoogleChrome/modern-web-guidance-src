---
description: Inspect and control third-party cookies and check HTTPS protection using the Privacy and security panel in Chrome DevTools.
filename: privacy-and-security-panel
category: security
---

# Privacy and Security Panel Best Practices

The **Privacy and security** panel in Chrome DevTools is a powerful tool for understanding and managing how websites handle cookies and security. This guide outlines best practices for using this panel to ensure a more secure and privacy-conscious browsing experience.

## Inspecting and Controlling Third-Party Cookies

The **Privacy** section of the panel allows you to examine and limit third-party cookies.

### Temporarily Limit Third-Party Cookies

To test how a website behaves when third-party cookies are restricted in Chrome:

1.  Navigate to the **Privacy** section in the panel.
2.  Under **Controls**, enable **Temporarily limit third-party cookies**.
3.  Consider enabling exceptions if necessary:
    *   **Third-party cookie grace period**: Allows specific sites to use third-party cookies for a limited time. This is useful for gradual transitions and testing.
    *   **Heuristics based exception**: Grants access to third-party cookies in predefined scenarios like pop-ups or redirects, aiding in testing specific user flows.
4.  After making changes, click the **Reload** icon (<span class="material-symbols-outlined" aria-hidden="true">refresh</span>) that appears at the top of DevTools to apply them.

### Inspecting Third-Party Cookies

Once third-party cookies are limited (with or without exceptions), you can inspect their status:

*   Go to the **Privacy** > **Third-party cookies** section.
*   If no third-party cookies are present, you'll see a "Not a crumb left" message.
*   If cookies are present, they will be listed in a table detailing their status (Allowed or Blocked) and providing recommendations.
*   **Filter the table**: Use the status filters (**All**, **Allowed**, **Blocked**) or type in the filter box to search by cookie name or domain.
*   **Sort the table**: Click on column headers to sort the cookie data.

## Identifying and Fixing Security Issues

The **Security** section helps you find and resolve common security problems.

### Non-Secure Main Origins

If the main origin of a page is not secure (i.e., uses HTTP instead of HTTPS), the **Security** > **Overview** will state "This page is not secure."

*   **Problem**: The URL was accessed via HTTP.
*   **Solution**: Ensure your website is served over HTTPS. If HTTPS is already set up, configure your server to redirect all HTTP requests to HTTPS. Consider using services like Let's Encrypt for free SSL certificates or hosting on a CDN that provides HTTPS by default.
*   **Tip**: Use the "Redirect HTTP Traffic To HTTPS" audit in Lighthouse to automate checks.

### Broken HTTPS

If there are issues with a site's HTTPS implementation (e.g., an expired certificate), the **Security** > **Overview** will provide details.

*   **Action**: Investigate the cause of the broken HTTPS connection, typically related to certificate validity or configuration.

### Mixed Content

Mixed content occurs when a secure page (HTTPS) loads resources from non-secure origins (HTTP). This exposes users to risks like eavesdropping and man-in-the-middle attacks.

*   **Identification**: Navigate to **Security** > **Non-secure origins**.
*   **Investigate**: Click "View requests in Network panel" to see a filtered list of non-secure resources in the Network panel.
*   **Resolution**: Update all resource URLs to use HTTPS or remove them if they are not essential.

## Viewing Security Details

The panel provides detailed information about origin security.

### View Main Origin Certificate

*   From the **Security** > **Overview**, click **View certificate** to inspect the main origin's SSL certificate details.

### View Origin Details

*   Click on specific entries within the **Security** section to view detailed origin information, including connection and certificate data. Certificate transparency information is also displayed when available.

By regularly using the Privacy and security panel, developers can proactively identify and resolve security vulnerabilities, ensuring a safer experience for their users.