# Contributing to Guidance

We'd love to accept your patches! Before we can take them, we have to jump a couple of legal hurdles.

## Contributor License Agreements

All submissions to Google Open Source projects need to follow Google’s Contributor License Agreement (CLA).

*   If you are an individual writing original source code and you're sure you own the intellectual property, then you'll need to sign an [individual CLA](https://developers.google.com/open-source/cla/individual).
*   If you work for a company that wants to allow you to contribute your work, then you'll need to sign a [corporate CLA](https://developers.google.com/open-source/cla/corporate).

Follow either of the two links above to access the appropriate CLA and instructions for how to sign and return it. Once we receive it, we'll be able to accept your pull requests.

## Contribution Workflow

This project follows a **two-checkpoint contribution model** for adding web guidance (guides):
1.  **Checkpoint 1: Use case identification (Stub stage)** — Propose the use case, a basic demo, and get approval.
2.  **Checkpoint 2: Implementation (Eval-ready stage)** — Author the guide, expectations, and use `gd dev` to generate/calibrate the grader.

For a detailed walkthrough of this workflow, see [CONTEXT.md](./CONTEXT.md).

## Development Setup

This project is managed as a **pnpm workspace**. To set up your local environment:

```bash
pnpm install
pnpm setup:playwright
```

## Quality Control

Before submitting a pull request, please ensure your changes pass the quality control suite. Run the following command from the root:

```bash
pnpm preflight
```

This command will:
- Build all packages.
- Typecheck the codebase.
- Lint the code using `oxlint`.
- Run all tests.
