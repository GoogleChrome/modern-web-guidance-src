---
description: Learn how to inspect Application Cache data using Chrome DevTools to understand cached resources and their statuses.
filename: view-application-cache-data
category: webperf
---

# View Application Cache Data With Chrome DevTools

{{ macros.Authors(["kaycebasques"]) }}

<aside class="warning"><b>Warning:</b> Support for AppCache</a> was removed from Chrome and other Chromium-based browsers. <a href="https://web.dev/articles/appcache-removal">Prepare for AppCache removal</a>.</aside>

This guide shows you how to use [Chrome DevTools](/docs/devtools) to inspect Application Cache resources.

## View Application Cache Data {: #view }

1. Click the **Sources** tab to open the **Sources** panel. The **Manifest** pane usually opens by default.

   <img src="image/the-manifest-pane-d62111686fdaf.png" alt="The Manifest pane" width="800" height="619">

1. Expand the **Application Cache** section and click a cache to view its resources.

   <img src="image/the-application-cache-pan-8483b6caa05b4.png" alt="The Application Cache pane" width="800" height="427">

Each row of the table represents a cached resource.

The **Type** column represents the resource's category:

* **Master**. The `manifest` attribute on the resource indicated that this cache is the resource's master.
* **Explicit**. This resource was explicitly listed in the manifest.
* **Network**. The manifest specified that this resource must come from the network.
* **Fallback**. The URL is a fallback for another resource. The URL of the other resource is not listed in DevTools.

At the bottom of the table there are status icons indicating your network connection and the status of the Application Cache. The Application Cache can have the following statuses:

* **IDLE**. The cache has no new changes.
* **CHECKING**. The manifest is being fetched and checked for updates.
* **DOWNLOADING**. Resources are being added to the cache.
* **UPDATEREADY**. A new version of the cache is available.
* **OBSOLETE**. The cache is being deleted.