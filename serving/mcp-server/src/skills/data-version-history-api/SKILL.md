---
description: Retrieve Chrome release version history and release information for specific platforms and channels using the VersionHistory API.
filename: version-history-api
category: data
---

# Version History API

This document provides examples and best practices for using the VersionHistory web service API to query Chrome release data.

## Platform Information

### Listing All Platforms

To get a list of all supported platforms:

```http
GET https://versionhistory.googleapis.com/v1/chrome/platforms/
```

### Listing All Platform and Channel Combinations

To retrieve all combinations of platforms and their associated channels:

```http
GET https://versionhistory.googleapis.com/v1/chrome/platforms/all/channels
```

### Listing All Versions for All Combinations

To fetch all version numbers across all platforms and channels:

```http
GET https://versionhistory.googleapis.com/v1/chrome/platforms/all/channels/all/versions
```

## Version Information

### Versions for a Specific Platform and Channel

To list all versions for a specific platform (e.g., Windows - `win`) in a particular channel (e.g., `stable`):

```http
GET https://versionhistory.googleapis.com/v1/chrome/platforms/win/channels/stable/versions
```

### Versions in Ascending Order

To retrieve versions for a specific platform and channel, ordered by version number:

```http
GET https://versionhistory.googleapis.com/v1/chrome/platforms/win/channels/stable/versions?order_by=version%20asc
```

### Versions Across Multiple Channels

To list versions for a platform across several channels (e.g., Windows in `stable`, `beta`, and `dev`):

```http
GET https://versionhistory.googleapis.com/v1/chrome/platforms/win/channels/all/versions/?filter=channel<=dev
```

## Release Information

### Releases for a Specific Platform and Channel

To get all release details for a platform and channel combination:

```http
GET https://versionhistory.googleapis.com/v1/chrome/platforms/win/channels/stable/versions/all/releases
```

### Releases for a Specific Version

To find all releases associated with a particular version number (e.g., `85.0.4183.83`):

```http
GET https://versionhistory.googleapis.com/v1/chrome/platforms/all/channels/all/versions/85.0.4183.83/releases
```

### Releases Currently Being Served

To identify releases for a platform that are currently active (using a common placeholder for "not ended"):

```http
GET https://versionhistory.googleapis.com/v1/chrome/platforms/win/channels/all/versions/all/releases?filter=endtime=1970-01-01T00:00:00Z
```

### Releases at 100% Rollout

To find releases for a platform and channel that have achieved full rollout:

```http
GET https://versionhistory.googleapis.com/v1/chrome/platforms/win/channels/stable/versions/all/releases?filter=fraction=1
```

## Best Practices

*   **Parameter Usage:** Utilize query parameters such as `order_by` and `filter` to refine your API requests and retrieve precise data.
*   **Platform and Channel Codes:** Familiarize yourself with the correct codes for platforms (e.g., `win`, `mac`, `linux`, `android`, `ios`) and channels (e.g., `stable`, `beta`, `dev`, `canary`).
*   **Error Handling:** Implement robust error handling in your application to manage potential API issues, such as invalid requests or network problems.
*   **Data Caching:** For frequently accessed data, consider implementing a caching mechanism to reduce the number of API calls and improve performance.
*   **Rate Limiting:** Be mindful of API rate limits. If you anticipate high-volume usage, consult the API documentation for details on usage quotas.