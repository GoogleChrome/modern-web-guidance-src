# Contributor Ecosystem & Governance

`GoogleChrome/modern-web-guidance-src` is an open source project providing authoritative guidance on modern web platform features for AI coding agents and human developers. The project depends on contributions from the web community and Subject Matter Experts across the ecosystem.

This document outlines contributor roles, authoring permissions, and decision-making processes.


## Roles and Responsibilities

### Contributors

Contributors are community members who submit improvements, bug fixes, and documentation updates. Anyone can become a Contributor.

Contributors:
* Submit changes via pull requests for bug fixes, doc updates, Baseline compatibility, and improvements to existing guides.
* Propose new guidance topics and use cases by [opening an issue](https://github.com/GoogleChrome/modern-web-guidance-src/issues).
* Review pull requests (advisory).
* Have pull requests reviewed and merged by the assigned [Content ATL](./guides/ATLS.md) or an [Owner](#owners).

> **Note on Authoring New Guidance**: Because guidance is directly ingested by AI coding assistants, **authoring new guidance from scratch is reserved for [Peers](#peers)** unless permitted by a [Content ATL](./guides/ATLS.md) or [Owner](#owners).


### Peers

Peers are formally onboarded Subject Matter Experts with write access to the repository.

Peers:
* Author brand-new guidance (use cases, `guide.md`, `demo.html`, and `expectations.md`).
* Review pull requests across the codebase (peer reviews).
* Submit pull requests subject to review and merge by the assigned [Content ATL](./guides/ATLS.md) or [Owner](#owners).

To become a Peer, one must:
* Demonstrate subject-matter expertise in modern web development and familiarity with repository authoring standards.
* Contribute high-quality work (PRs, reviews, discussions) in a collaborative manner.

Candidates can be nominated by any Peer, Content ATL, or Owner, and are confirmed by a majority vote of the Owners. Peer status is maintained through active engagement; inactive Peers may be retired by the Owners and reinstated upon return.


### Content Area Tech Leads (Content ATLs)

Content ATLs are Peers who take formal ownership over specific domain categories (e.g., *Performance*, *CSS*, *Forms*, *UI Behaviors*, *Accessibility*) or feature horizontals (e.g., *Motion*, *WebAuthn*). Domain assignments are defined in **[`guides/atls.json`](./guides/atls.json)** and detailed in **[`guides/ATLS.md`](./guides/ATLS.md)**.

Content ATLs:
* Serve as the primary technical authority for their assigned categories.
* Triage issues, validate proposed use cases, and participate in evaluation investigations within their domain.
* Review, approve, and merge Stage 2 guidance pull requests within their domain.
* Maintain guidance accuracy, eval readiness, and Baseline fallback alignment.
* Have their own pull requests reviewed and approved by another Content ATL or an Owner prior to merging.

Content ATLs are appointed by the Owners based on domain expertise and active stewardship.


### Owners

Owners govern the project in consultation with Content ATLs and Peers. Owners are responsible for overall project health, technical direction, repository infrastructure, CLI tooling (`gd`), serving distributions, and governance.

Owners:
* Author guidance and contribute across the repository alongside Peers.
* Manage infrastructure, toolchain, serving pipelines, schemas, and repository settings.
* Appoint Content ATLs and confirm new Peers and Owners.
* Resolve cross-domain disagreements on feature taxonomy and project policy.
* Approve and merge changes to governance, infrastructure, and [`CODEOWNERS`](./CODEOWNERS)-protected paths.
* Release packages and manage major version releases.

To become an Owner, one must:
* Demonstrate long-term commitment, technical leadership, and deep familiarity with project architecture and standards.
* Actively drive project direction, infrastructure, and community health.

New Owners are nominated by existing Owners and confirmed by majority vote.


## Decision Making

Decisions follow a consensus-seeking model among the maintainers. If consensus cannot be reached, decisions are resolved by a simple majority vote among the Owners. Decisions are documented in writing (e.g., via pull requests, issues, or documentation updates).


## Project Meetings

The Owners meet quarterly, or as needed, to review project health and roadmap priorities.
