---
description: Learn how to view, edit, and delete IndexedDB data using Chrome DevTools for effective debugging and data management.
filename: indexeddb-data-management
category: data
---

# Managing IndexedDB Data with Chrome DevTools

This guide demonstrates how to leverage Chrome DevTools to inspect, modify, and remove data stored in IndexedDB databases.

## Viewing IndexedDB Data

1.  Open the **Application** panel by clicking the **Application** tab.
2.  Expand the **IndexedDB** menu to see available databases. Each entry shows the database name and its origin.
3.  Click on a database to view its origin and version number.
4.  Click on an object store to see its key-value pairs.
    *   **Total entries**: The count of all key-value pairs in the store.
    *   **Key generator value**: The next available key, relevant when using key generators.
5.  Expand a value in the **Value** column to view its details.
6.  Click on an index name (e.g., **title** or **body**) to sort the object store by that index's values.

**Note:** Third-party databases are not visible in DevTools.

## Refreshing IndexedDB Data

IndexedDB data in the **Application** panel does not update automatically.
*   To refresh a specific object store, click the **Refresh** button <img src="image/refresh-339b3ca8f9bc.png" alt="Refresh" width="24" height="25"> while viewing the object store.
*   To refresh all data for a database, navigate to the database view and click **Refresh database**.

## Editing IndexedDB Data

Direct editing of IndexedDB keys and values is not supported in the **Application** panel. However, you can use **Snippets** to run JavaScript code within DevTools to modify IndexedDB data.

### Using Snippets for Data Editing

1.  Navigate to the **Snippets** tab in DevTools.
2.  Create a new Snippet and write JavaScript code to interact with your IndexedDB database (e.g., to update, add, or delete entries).
3.  Run the Snippet. The results will be logged to the **Console**.

## Deleting IndexedDB Data

### Deleting a Key-Value Pair

1.  View the IndexedDB object store containing the pair you wish to delete.
2.  Click on the key-value pair to select it (it will be highlighted blue).
3.  Press the <kbd>Delete</kbd> key or click the **Delete Selected** <img src="image/delete-selected-e482249091b3c.png" alt="Delete Selected" width="20" height="20"> button.

### Deleting All Key-Value Pairs in an Object Store

1.  View the IndexedDB object store.
2.  Click the **Clear object store** <img src="image/clear-object-store-6f3a9c9e1113e.png" alt="Clear object store" width="26" height="26"> button.

### Deleting an IndexedDB Database

1.  View the IndexedDB database you intend to delete.
2.  Click the **Delete database** button.

### Deleting All IndexedDB Storage

1.  Open the **Clear storage** pane.
2.  Ensure the **IndexedDB** checkbox is selected.
3.  Click **Clear site data**.