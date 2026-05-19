# Contributing to Guidance

We'd love to accept your patches! We believe it is critical that developers, and their AI agents, have access to the highest quality documentation and guidance.

Just like all other Google open source projects, we require a signed Contributor License Agreement (CLA) for any contribution (even one that just changes documentation).

## Contributor License Agreements

All submissions to Google Open Source projects need to follow Google’s Contributor License Agreement (CLA).

*   If you are an individual writing original source code and you're sure you own the intellectual property, then you'll need to sign an [individual CLA](https://developers.google.com/open-source/cla/individual).
*   If you work for a company that wants to allow you to contribute your work, then you'll need to sign a [corporate CLA](https://developers.google.com/open-source/cla/corporate).

Follow either of the two links above to access the appropriate CLA and instructions for how to sign and return it. Once we receive it, we'll be able to accept your pull requests.

## Scope and positioning policies
### Vendor-agnostic guidance
* Core guides focus on web features aligned with the [web-features project](https://github.com/web-platform-dx/web-features), meaning we key on web-feature IDs and Browser Compat Data (BCD) keys to handle compatibility and fallbacks. The guides must remain vendor-agnostic. Negative standards positions are not a reason to exclude guides on how to use a feature.
* Non-web scope: Branded or proprietary extensions (for example, Chrome Extensions, Chrome Web Store APIs, Google Play integration) are available behind an opt-in flag.

### Origin trial (OT) support policy
* Origin trial features are excluded from the core guidance. OT features exhibit high API and syntax volatility, require additional steps that are outside of the scope of just code changes and will generally not be what developers expect to see in their code unprompted. To support developers experimenting with cutting-edge features without exposing most developers to that churn, we’ll treat those as opt-in.

# Repository architecture and release flow
To foster an open-source contributor environment while maintaining a stable, clean installation path for end-users, we utilize a two-repo architecture:
* **Source repo** ([GoogleChrome/modern-web-guidance-src](https://github.com/GoogleChrome/modern-web-guidance-src/)): Contains development scripts, eval tasks, agent harnesses, raw guidance files, tests, etc. All contributors submit PRs and file issues here.
* **Installation repo** ([GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance)): Contains compiled, ready-to-consume skills and agent-specific plugin configurations. This is the clean, stable repo that users clone to install the skills. This is a read-only repo. No issues and no PRs. 
* **Sync & build mechanism**: Changes merged into `modern-web-guidance-src` lead to a build pipeline that updates both the `modern-web-guidance` install repo and [CLI's NPM package](https://www.npmjs.com/package/modern-web-guidance).

# How to contribute
We want to encourage contributions while maintaining high standards. Our policy is:
* **Proposal first**: For non-trivial changes, contributors need to to [open an issue first](https://github.com/GoogleChrome/modern-web-guidance-src/issues) to align on design before coding.

## Development Setup

This project is managed as a **pnpm workspace**. To set up your local environment:

```bash
pnpm install
pnpm setup:playwright
```

For a walkthrough of the project architecture, see [CONTEXT.md](./CONTEXT.md).

## Quality Control

Before submitting a pull request, please ensure your changes pass lint, typecheck, tests, etc:

```bash
pnpm preflight
```
