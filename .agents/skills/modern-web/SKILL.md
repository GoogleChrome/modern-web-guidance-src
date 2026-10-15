---
name: modern-web
version: 1.1.0
description: Searches, analyzes, and retrieves modern web development guides and recommended practices
dependencies: []
---

# Modern Web Best Practices Guide Skill

This skill provides access to modern web best practices guides and static analysis for modern web platform standards. It teaches the assistant how to discover, analyze, and retrieve recommended implementations for modern web development use cases (HTML, CSS, or JavaScript).

## Instructions for the Agent

### 1. Codebase Modernization Analysis (`analyze`)
To discover legacy patterns in an existing codebase and identify modernization opportunities:
- **Scan directory**: Execute `npx -y modern-web-guidance@latest analyze [dir] --json` (or `node bin/gd.ts analyze [dir] --json` within this repository).
- **Plan refactoring**: Group detected issues by `guideId`, review affected files, and report a clear migration plan to the user before editing.
- **Retrieve relevant guides**: For each approved modernization, retrieve the guide (`npx -y modern-web-guidance@latest retrieve "<guideId>"`).
- **Refactor and verify**: Apply standard modern replacements and re-run `analyze` to verify findings are cleanly resolved.
- **Report**: Provide a concise summary of changes and browser compatibility notes.

### 2. Search & Retrieve Guides
To find recommended ways to implement a new web development use case:
- **Search for use cases**: Execute `npx -y modern-web-guidance@latest search "<query>"` (or `node bin/gd.ts` / `serving/bin/modern-web.ts search <query>`).
- **Retrieve detailed guides**: Execute `npx -y modern-web-guidance@latest retrieve "<id>"` to fetch the complete guide and best practices.
- Always refer to these guides when writing web development code to ensure compliance with modern web standards and Baseline support.

