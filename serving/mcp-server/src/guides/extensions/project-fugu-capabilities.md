---
description: Enable web apps to perform actions previously only available to native apps by exposing native platform capabilities to the web.
filename: project-fugu-capabilities
category: extensions
---

# Project Fugu: Unlocking New Capabilities for the Web

Project Fugu aims to close the "app gap" by enabling web apps to do anything native apps can. This is achieved by exposing native platform capabilities to the web platform while prioritizing user security, privacy, and trust.

## The "App Gap"

The web is a powerful platform due to its reach, ease of use, and open ecosystem. However, certain applications are not possible to build and deliver on the open web today, creating an "app gap" between web and native experiences. Project Fugu seeks to eliminate this gap.

## Design and Implementation Process

Project Fugu follows an open, developer-centric process for designing and developing new web platform capabilities:

1.  **Identify the Developer Need:** Understand what developers are trying to accomplish, who would use the capability, their current methods, and the problems this new feature would solve. Feature requests often come through bug reports on `bugs.chromium.org`.
    *   **Have a suggestion for a capability?** File a [new feature request](https://goo.gl/qWhHXU) with detailed information about the problem, use cases, and any helpful context.

2.  **Create an Explainer:** Develop a design document that outlines the problem and includes sample code demonstrating a potential API. This explainer serves as a living document for iterative development.

3.  **Get Feedback and Iterate on the Explainer:** Publicize the explainer to gather feedback from developers and the community. This step is crucial for verifying that the capability meets developer needs and expectations, and for gauging public support.

4.  **Move to Specification & Iterate:** Transition the design to a formal specification, collaborating with developers and browser vendors. Once the design stabilizes, an [origin trial](https://github.com/GoogleChrome/OriginTrials) is used for experimental implementation and gathering real-world feedback from users.

5.  **Ship It:** After a successful origin trial, a finalized spec, and completion of all launch steps, the capability is shipped to stable.

## Design for User Security, Privacy, and Trust

A core principle of Project Fugu is to ensure that new web capabilities are designed with robust security, privacy, and trust mechanisms.

*   **Permission Model:** Access to powerful features should never be granted by default. Instead, a clear permission model that gives users total control and allows for easy revocation is essential.
*   **Transparency:** It must be crystal clear when and how these APIs are being used.

For further details on controlling access to powerful web platform features, refer to [Controlling Access to Powerful Web Platform Features](https://bit.ly/powerful-apis).

## Resources

*   **Fugu Status:** [https://web.dev/articles/fugu-status/](https://web.dev/articles/fugu-status/) - A list of APIs currently in development.
*   **WICG Discourse:** [https://discourse.wicg.io/](https://discourse.wicg.io/) - Provide input on evolving features.
*   **Origin Trials:** [https://github.com/GoogleChrome/OriginTrials/blob/gh-pages/developer-guide.md](https://github.com/GoogleChrome/OriginTrials/blob/gh-pages/developer-guide.md) - Information on experimenting with new features.