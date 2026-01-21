---
description: Prepare and serve video files efficiently on the web by understanding media containers, codecs, bitrate, and resolution.
filename: media-file-basics
category: media
---

# Media File Basics

Reference docs:
- https://developer.mozilla.org/docs/Web/Media/Formats
- https://caniuse.com/

## Best Practices

When preparing video files for web streaming, it's crucial to understand the underlying concepts of media containers and codecs to ensure optimal performance and compatibility across different browsers and devices.

### Containers and Codecs

*   **Container:** The file format (e.g., `.mp4`, `.webm`) that holds one or more streams of media data.
*   **Stream:** A sequence of data within a container, such as audio or video.
*   **Codec (Coder/Decoder):** The compression format used within a stream to reduce file size (e.g., AVC (H.264), VP9 for video; AAC, Opus for audio).

Files with the same container can use different codecs, impacting quality and file size. For example, WebM containers are often smaller for streaming but may have less universal browser support than MP4.

### Bitrate and Resolution

*   **Bitrate:** The amount of data used to encode one second of a stream. Higher bitrate generally means higher quality but larger file size.
*   **Resolution:** The number of pixels in each dimension of a video frame. Higher resolution provides more detail but also increases file size.

### Serving Strategy

1.  **Understand browser support:** Not all browsers support all container and codec combinations. For instance, WebM is excellent for the web but not universally supported by Safari.
2.  **Provide fallbacks:** Always offer an MP4 container with a widely supported codec (like AVC (H.264) and AAC) as a fallback for browsers that don't support newer formats like WebM with VP9 or AV1.
3.  **Optimize for web:** Raw camera files (like `.mov` or uncompressed `.mp4`) are often too large for efficient web streaming. Convert them to web-optimized formats.
4.  **Consider adaptive streaming:** For a better user experience, especially with varying network conditions, prepare multiple versions of your video at different bitrates and resolutions. This often involves creating manifests to guide the player.

### Preferred File Types and Codecs

| File type | Video Codec        | Audio Codec | Notes                               |
| :-------- | :----------------- | :---------- | :---------------------------------- |
| [MP4]     | [AV1], [AVC (H.264)]*, [VP9] | [AAC]       | Good general choice, best fallback. |
| [WebM]    | [AV1], [VP9]*      | [Vorbis], [Opus] | Excellent for web, use with fallback. |

\* Indicates the preferred video codec.

## Fallback Strategies

When delivering video content, ensure a robust fallback strategy to guarantee playback across all target browsers.

*   **Primary format:** Offer modern formats like WebM with VP9 or AV1 for optimal quality and efficiency where supported.
*   **Fallback format:** Always include an MP4 file encoded with AVC (H.264) and AAC audio as a universal fallback. This ensures playback even on browsers with limited support for newer codecs.
*   **Feature detection:** Use JavaScript or `<video>` tag attributes like `canPlayType` to detect browser support for specific media formats before deciding which file to play.

```html
<video controls>
  <source src="video.webm" type="video/webm">
  <source src="video.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>
```

By implementing these practices, you can ensure your video content is accessible, performs well, and provides a positive viewing experience for your users.