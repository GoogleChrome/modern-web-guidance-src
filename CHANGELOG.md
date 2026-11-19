# Changelog - Modern Web Guidance

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-14

### Added

- Initial release of Modern Web Guidance
- Build system with pnpm 10.x support
- TypeScript compilation with oxlint
- Playwright e2e tests
- Guide generation system
- Skills CLI distribution

### Changed

- Migrated from pnpm 8.x to 10.x configuration
- Removed deprecated `pnpm` field from package.json
- Moved `onlyBuiltDependencies` and `overrides` to root level
- Added development scripts: `dev`, `preview`, `clean`, `watch`

### Fixed

- Build warnings about deprecated pnpm field
- Dependency resolution for @openai/codex and @anthropic-ai/claude-code

## [0.9.0] - 2024-11-10

### Added

- Initial project setup
- Core guide generation infrastructure
- Skills authoring system
- Evaluation harness

### Changed

- Migrated from npm to pnpm
- Updated Node.js requirement to >=22.18.0

## [0.8.0] - 2024-11-05

### Added

- Initial project structure
- Guide authoring workflow
- Evaluation framework
