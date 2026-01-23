---
description: Provides a unified way for users to log in to websites using their existing identity providers, reducing the need for multiple accounts and passwords.
filename: federated-credential-management-api
category: identity
---

# Federated Credential Management API (FedCM)

FedCM provides a unified API for identity providers (IdPs) and relying parties (RPs) to manage federated identity, enabling users to log in to websites using their existing accounts without sharing unnecessary data.

## Primary Use Case: Simplified User Authentication

The main use case for FedCM is to streamline the login process for users by allowing them to authenticate with a website using credentials from a trusted identity provider. This eliminates the need for users to create and manage separate accounts for each website and reduces friction during signup and login.

## Best Practices

-   **For Identity Providers (IdPs):**
    -   Ensure your IdP is discoverable and compliant with FedCM standards.
    -   Provide clear user consent prompts that accurately reflect the data being shared with the relying party.
    -   Consider implementing the Registration API to allow RPs to accept any compliant IdPs, benefiting smaller IdPs.
    -   Monitor the "Metrics endpoint" for performance insights.

-   **For Relying Parties (RPs):**
    -   Integrate FedCM into your login and signup flows.
    -   Clearly communicate to users why FedCM is being used and what information will be shared.
    -   Explore the "Improved Fields API" to request more specific identity attributes (e.g., phone number, username) and improve the disclosure UI.
    -   Consider how FedCM can integrate with other Chrome features like Passkeys and Autofill for a seamless user experience.
    -   If you have specific needs, actively participate in discussions on the FedID CG repository to influence the API's evolution.

## Key Features and Considerations

-   **Registration API:** Enables RPs to accept any compliant IdP, enhancing flexibility and interoperability.
-   **Improved Fields API:** Allows for requesting more granular identity attributes and enhances the user disclosure UI.
-   **Relationship with mDLs/VCs/etc.:** Ongoing work to integrate FedCM with emerging identity standards like the Digital Credentials API.
-   **Integration with other Chrome features:** Synergies with Passkeys and Autofill aim to provide a more cohesive authentication experience.
-   **Delegation-oriented FedCM:** Experimentation with supporting 3-party token formats (e.g., SD-JWT-KB, MDocs, BBS) to address the IdP Tracking Problem.
-   **Enterprises and Education:** Addressing use cases not yet fully supported by FedCM, such as front-channel logout.

## Resources

-   [Introduction to Federated Credential Management](/docs/identity/fedcm/overview)
-   [Federated Credential Management API: developer guide](/docs/identity/fedcm/implement/identity-provider)