---
description: Automate Chrome Web Store API operations for managing extensions, including submissions, rollouts, and status checks, simplifying developer workflows.
filename: chrome-webstore-api-automation
category: extensions
---

# Automating Chrome Web Store API Operations

This document outlines best practices for leveraging the Chrome Web Store API (V2) to streamline the management of your Chrome extensions. The V2 API offers enhanced functionality and improved ergonomics for developers.

## Key Use Cases and Best Practices

### 1. Managing Extension Submissions and Updates

The V2 API provides robust methods for submitting, updating, and publishing your extensions.

**Best Practices:**

*   **Understand Revision Concepts:** The API now clearly defines item revisions, distinguishing between drafts and published versions. Ensure your workflow accounts for these distinctions.
*   **Utilize `fetchStatus` for Item Status:** Employ the `fetchStatus` method to retrieve both published and pending revision statuses for an item.
    ```shell
    curl -H "Authorization: Bearer $TOKEN" -X GET https://chromewebstore.googleapis.com/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:fetchStatus
    ```
*   **Programmatic Submission:** For automated workflows, use the `publish` method to submit your extension for review.
    ```shell
    POST https://chromewebstore.googleapis.com/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:publish
    ```
*   **Staged Publishing:** Leverage the `STAGED_PUBLISH` option for `publishType` if you need to manually approve publication after review.
    ```json
    {
      "publishType": "STAGED_PUBLISH"
    }
    ```

### 2. Controlling Deployment Rollouts

The V2 API enables granular control over how your extension is rolled out to users.

**Best Practices:**

*   **Modify Percentage Rollout:** Update the deployment percentage without requiring a full re-review by using the `setPublishedDeployPercentage` method. This is crucial for phased rollouts and quick adjustments.
    ```shell
    curl -H "Authorization: Bearer $TOKEN" -X POST -H "Content-Type: application/json" -d "{ "deployPercentage": 100 }" https://chromewebstore.googleapis.com/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:setPublishedDeployPercentage
    ```
*   **Cancel Pending Submissions:** If a submission needs to be halted before review, use the `cancelSubmission` method.
    ```shell
    curl -H "Authorization: Bearer $TOKEN" -X POST https://chromewebstore.googleapis.com/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:cancelSubmission
    ```

### 3. Integrating with Enterprise Workflows using Service Accounts

The V2 API supports service accounts, making it easier to integrate Chrome Web Store management into automated enterprise systems.

**Best Practices:**

*   **Grant Service Account Access:** Configure service accounts in the Chrome Web Store Developer Dashboard by adding their required emails.
*   **Secure API Calls:** Ensure your service account credentials are managed securely and used appropriately for authentication.

### 4. Improving API Ergonomics and Discoverability

The V2 API emphasizes improved developer experience through better documentation and tooling integration.

**Best Practices:**

*   **Utilize Discovery Document:** Interact with the API using the provided discovery document, which facilitates integration with various Google tooling and client libraries.
*   **Explore with "Try it!":** For direct interaction and testing, use the API explorer available in the extensive API reference documentation.
*   **OAuth 2.0 Playground:** Test API requests and obtain credentials using the OAuth 2.0 playground, selecting the appropriate Chrome Web Store API scope.
*   **Google Client Libraries:** Integrate the API calls into your applications using the official Google API client libraries for languages like JavaScript, Python, and Java.

## Migration from V1 to V2

The V2 API maintains many functionalities of V1 but with updated endpoints and request/response formats.

**Key Differences:**

*   **New Endpoints:** V1 endpoints have been replaced by V2 equivalents. Refer to the migration table in the official documentation for specifics.
    *   Get Item: `GET https://www.googleapis.com/chromewebstore/v1.1/items/itemId` -> `GET https://chromewebstore.googleapis.com/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:fetchStatus`
    *   Update Item: `PUT https://www.googleapis.com/upload/chromewebstore/v1.1/items/itemId` -> `POST https://chromewebstore.googleapis.com/upload/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:upload`
    *   Publish Item: `POST https://www.googleapis.com/chromewebstore/v1.1/items/itemId/publish` -> `POST https://chromewebstore.googleapis.com/v2/publishers/PUBLISHER_ID/items/EXTENSION_ID:publish`
*   **Unsupported Features in V2:**
    *   Creating new items via API is no longer supported.
    *   Changing item visibility via API is deprecated.

**Migration Timeline:**

The V1 API will be supported until October 15th, 2026. Ensure your migration to V2 is completed before this date.

## Further Resources

*   **API Reference:** [Full Documentation][reference]
*   **Tutorials and Examples:** [Use the Chrome Web Store API][tutorial]
*   **Mailing List for Feedback:** [chromium-extensions][mailing-list]

[reference]: /docs/webstore/api/reference/rest/
[tutorial]: /docs/webstore/using-api
[mailing-list]: https://groups.google.com/a/chromium.org/g/chromium-extensions