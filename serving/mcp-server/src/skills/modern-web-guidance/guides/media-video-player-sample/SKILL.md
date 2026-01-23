---
description: Build and distribute an open-source, customizable video player web app with features like playlists, multiple format support, and social sharing.
filename: video-player-sample
category: media
---

# Video Player Sample

Reference docs:
- [The Video Player Sample](https://code.google.com/archive/p/video-player-sample/)
- [Closure Library](https://developers.google.com/closure/)
- [Closure Compiler](https://developers.google.com/closure/compiler/)

## Best Practices

The Video Player Sample is an open source video player web app that can be customized, extended, or used out of the box. It's built using HTML and JavaScript, following the Model View Controller pattern and structure.

### Key Features to Implement

*   **Video Playback:** Offer a beautiful video watching experience, including a full-screen view.
*   **Content Management:** Enable users to watch single videos or create playlists from uploaded content.
*   **Format Support:** Ensure support for multiple video formats (WebM, Ogg, MP4, and Flash fallback) based on browser capabilities.
*   **Discoverability:** Include a "Categories" page for an overview of shows or categories.
*   **Notifications:** Implement notifications for new episodes when distributed via the Chrome Web Store.
*   **Social Sharing:** Integrate built-in support for sharing to Google+, Twitter, and Facebook.
*   **Customization:** Include all source files, including Photoshop PSDs, for easy customization.

### Technical Implementation

*   **Architecture:** Broadly follow the Model View Controller (MVC) pattern.
*   **JavaScript Library:** Utilize the open-source Google Closure JavaScript library.
*   **Compilation:** Compile your code with the Closure Compiler for optimization.
*   **Distribution:** Distribute through the Chrome Web Store to leverage features like notifications.
*   **Configuration:** Store configuration and video information in JSON files (e.g., `config.json`, `data.json`) within a `data` directory.

### Browser Support

The Video Player Sample should work in all modern browsers, in addition to being installable through the Chrome Web Store.

### Getting Started

*   **Demo:** Explore a live demo of the video player at [https://code.google.com/archive/p/video-player-sample/downloads](https://code.google.com/archive/p/video-player-sample/downloads).
*   **Documentation:** For in-depth understanding, refer to the project documentation: [https://code.google.com/archive/p/video-player-sample/](https://code.google.com/archive/p/video-player-sample/).
*   **Source Code:** Access the complete source code on Google Code: [https://code.google.com/archive/p/video-player-sample/](https://code.google.com/archive/p/video-player-sample/).