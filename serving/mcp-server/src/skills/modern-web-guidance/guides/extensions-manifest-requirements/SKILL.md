---
description: Guides developers on specifying essential technologies for Chrome extensions to ensure compatibility and prevent installation issues on unsupported systems.
filename: manifest-requirements
category: extensions
---

# Manifest - Requirements

This document outlines how to use the `"requirements"` property in your `manifest.json` file to declare the technologies your Chrome extension depends on. Properly specifying these requirements helps platforms like the Chrome Web Store inform users about potential compatibility issues before installation, leading to a better user experience and fewer support requests.

## Understanding Requirements

The `"requirements"` property in the manifest allows you to list specific technologies or features your extension needs to function correctly. This is particularly important for features that rely on specific hardware or software capabilities.

### The `"3D"` Requirement

The `"3D"` requirement specifically addresses the need for GPU hardware acceleration. It accepts either `"webgl"` or `"css3d"` as valid values, indicating that your extension requires these graphics capabilities.

*   **`"webgl"`**: Refers to the [WebGL API][1], enabling hardware-accelerated 3D graphics rendering within the browser. For more in-depth information on Chrome's 3D graphics support, consult the help article on [WebGL and 3D graphics][2].

You can declare your extension's 3D-related feature needs as shown in the following example:

```json
"requirements": {
  "3D": {
    "features": ["webgl"]
  }
}
```

### Deprecated `"plugins"` Requirement

Support for NPAPI plugins in extensions has been [discontinued][3] as of Chrome version 45. Consequently, the `"plugins"` requirement has been deprecated and is no longer a valid option for your `manifest.json` file. Developers should migrate away from using NPAPI plugins.

[1]: https://www.khronos.org/webgl/
[2]: https://support.google.com/chrome/answer/1220892
[3]: https://blog.chromium.org/2013/09/saying-goodbye-to-our-old-friend-npapi.html
[4]: /docs/extensions/npapi