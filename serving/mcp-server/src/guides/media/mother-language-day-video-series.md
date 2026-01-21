---
description: Showcase a weekly video series in multiple languages to celebrate International Mother Language Day.
filename: mother-language-day-video-series
category: media
---

# Celebrating International Mother Language Day with Videos

This document outlines how to showcase a weekly video series in multiple languages to celebrate International Mother Language Day.

## Primary Use Case

To engage with a global audience and celebrate linguistic diversity by releasing a weekly video hosted by team members in their native languages.

## Implementation Details

The primary mechanism for showcasing the videos is via an embedded `<devsite-video>` component. Each video release should be accompanied by a brief description, a link to a more detailed blog post, and a call to action to subscribe to the Chrome Developers channel.

### Video Embedding

Use the `<devsite-video>` component with the `video-id` attribute to embed videos.

```html
<devsite-video video-id="BgT-1-NgTsY"></devsite-video>
```

### Content Structure

Each video announcement should include:

*   A clear title, such as "# Celebrating International Mother Language Day".
*   The embedded video.
*   A concise explanation of the series' purpose.
*   A link to a blog post for more information.
*   A call to action for users to subscribe to relevant channels.
*   A "back to all episodes" link for easy navigation.

```html
<p>February 21st is International Mother Language Day! To celebrate, each week we’ll be releasing a new video hosted by one of our team members in their mother language.</p>

<p>Read more here: <a href="https://developer.chrome.com/blog/mother-language-day-2021">https://developer.chrome.com/blog/mother-language-day-2021</a></p>

<p>Don’t miss an episode, subscribe to Chrome Developers → <a href="https://goo.gle/ChromeDevs">https://goo.gle/ChromeDevs</a></p>

<a href="../" class="button"><span class="material-icons">arrow_back</span> Back to all episodes</a>
```

## Best Practices

*   **Consistency:** Maintain a consistent format for announcing each video episode.
*   **Accessibility:** Ensure video content is accessible with appropriate captions or transcripts if possible.
*   **Discoverability:** Use relevant keywords in the video titles and descriptions to improve searchability.
*   **Engagement:** Encourage user engagement through clear calls to action and links to further resources.