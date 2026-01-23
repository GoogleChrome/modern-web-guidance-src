---
description: Ensure compatibility and proper functioning of Chrome Apps by specifying the correct manifest version.
filename: manifest-version
category: extensions
---

# Manifest Version

Reference documentation:
- https://developer.chrome.com/docs/apps/reference/manifest/manifest-version

## Best Practices

Chrome Apps require developers to specify the `manifest_version` property in their `manifest.json` file to indicate compatibility with the manifest specification.

For current Chrome App development, you **must** set `"manifest_version": 2`.

```json
{
  "manifest_version": 2,
  "name": "My App",
  "version": "1.0"
  // ... other manifest properties
}
```

Manifest version 1 was deprecated in Chrome 18 and only applied to extensions and hosted apps, not Chrome Apps.

## Important Considerations

*   **Chrome App Support:** Chrome is phasing out support for Chrome Apps. While extensions will continue to be supported, developers should consider migrating their applications. Refer to the official Chrome blog for more details on the timeline and migration strategies.
*   **Manifest Stability:** The `manifest.json` format is generally stable. However, breaking changes can occur to address critical issues. Specifying the `manifest_version` helps ensure your app functions correctly with the intended version of the specification.