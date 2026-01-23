---
description: |
  Understand how community feedback shaped the CHIPS API design to improve its usability for developers while maintaining user privacy.
filename: chips-api-evolution
category: identity
---

# Evolving the CHIPS API with Community Feedback

The CHIPS (Cookies Having Independent Partitioned State) API allows developers to opt cookies into partitioned storage, creating separate cookie jars per top-level site. This is crucial for scenarios like third-party chat widgets, map embeds, and headless CMS providers that require state scoped to a single top-level site.

CHIPS is being developed as an open web standard through discussions in the PrivacyCG. An origin trial provided valuable feedback that led to design adjustments, ensuring the API better serves the web ecosystem.

## Key Design Challenges and Resolutions

Two significant challenges arose during CHIPS implementation, both of which were addressed through community feedback:

### 1. Removing the `Domain` Attribute Restriction

**Initial Proposal:** To encourage secure practices, partitioned cookies required the `Secure` attribute but disallowed the `Domain` attribute. This prevented sharing cookies between different subdomains within a partition.

**Challenge:** Partners and stakeholders reported that this restriction made it difficult for sites with subdomains (e.g., `shop.example.com` and `pay.example.com`) to share partitioned cookie jars. It also complicated authentication flows in embedded contexts.

**Resolution:** The Chrome team evaluated this feedback and determined that removing the `Domain` restriction would not compromise privacy and would significantly improve usability. After opening a discussion on GitHub, receiving positive comments from several companies, and gaining approval from Firefox, Edge, and Safari, the requirement was removed. This change acknowledged that some existing application architectures rely on sharing cookies between subdomains.

**Community Impact:** Tableau highlighted that this removal made the requirement more familiar, aligning it with previous changes like the `SameSite=None` attribute, and easing transitions for developers.

### 2. Moving from a Static to Dynamic Cookie Limit

**Initial Proposal:** To prevent excessive memory usage, the CHIPS design proposed a static limit of 10 cookies per-site per-partition.

**Challenge:** Akamai and other partners raised concerns that this static limit might be insufficient for services like CDNs that host customer content under their top-level domains (e.g., `customer.cdn.xyz`). Multiple customer sites embedded on another website could easily exceed the 10-cookie limit.

**Resolution:** After considering feedback from various forums, including partner meetings and W3C discussions, Chrome proposed a shift from a static 10-cookie limit to a dynamic 10 KB memory-based limit. This change was presented at TPAC 2022.

**Community Impact:** This dynamic limit was projected to cover 99% of web use cases while upholding privacy principles. Other browser vendors agreed with this updated solution, ensuring continued cross-browser support. Chrome subsequently adopted this new limit.

## Conclusion: The Power of Industry Collaboration

The development of CHIPS demonstrates the vital role of industry feedback in improving Privacy Sandbox technologies. Open conversations on GitHub, W3C meetings, and direct engagement with the Chrome team have led to tangible changes that enhance the usability and adoption of CHIPS, ultimately benefiting both developers and users while advancing web privacy.