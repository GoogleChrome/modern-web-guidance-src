---
description: Provides guidance on managing extension versions for auto-updates and display purposes.
filename: manifest-version-management
category: extensions
---

# Manifest Version Management

The `version` property in `manifest.json` is crucial for managing extension updates and is used by the Chrome Web Store to determine if an installed extension needs to be updated. A newer version string on the published extension will trigger an automatic update.

## Version Comparison

The autoupdate system compares version strings by comparing integers from left to right. A missing integer is treated as zero.

**Examples:**
- `1.2.0` is newer than `1.1.9.9999`.
- `1.1.9.9999` is newer than `1.1`.
- `1.1.9.9999` is older than `1.2`.

## Version Formatting Rules

The `version` string should consist of one to four dot-separated integers. Each integer must be between 0 and 65535, inclusive. Non-zero integers cannot start with a 0 (e.g., `032` is invalid).

**Valid Examples:**
- `"version": "1"`
- `"version": "1.0"`
- `"version": "2.10.2"`
- `"version": "3.1.2.4567"`

**Invalid Examples:**
- `99999` (integer too large)
- `032` (non-zero integer starts with 0)

## Displaying Version Information

While the `version` field is used for autoupdates, the `version_name` field can be used to provide a more descriptive string for display purposes. If `version_name` is not provided, the `version` field will be used for display.

**Examples of `version_name`:**
- `"version_name": "1.0 beta"`
- `"version_name": "build rc2"`
- `"version_name": "3.1.2.4567"`

**Note:** You are currently viewing documentation for Manifest V2, which is deprecated. For the current Manifest V3 equivalent, refer to the [Manifest V3 - Manifest version](link-to-mv3-documentation) documentation. The Chrome Web Store no longer accepts Manifest V2 extensions. Refer to the [Manifest V3 Migration guide](link-to-migration-guide) for instructions on converting your extension.