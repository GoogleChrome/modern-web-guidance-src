---
description: Explains how to lazy-load videos for improved web performance, covering both non-autoplay and animated GIF replacement scenarios.
filename: lazy-loading-video
category: webperf
---

# Lazy loading video

This post explains lazy loading and the options available to you to lazy loading video.

## For video that doesn't autoplay {: #video-no-autoplay }

Avoiding autoplaying videos is usually best practice as it leaves the control with the user. In these cases specifying the [`preload` attribute](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-preload) on the `<video>` element is the best way to avoid loading the whole video:

```html
<video controls preload="none" poster="one-does-not-simply-placeholder.jpg">
  <source src="one-does-not-simply.webm" type="video/webm">
  <source src="one-does-not-simply.mp4" type="video/mp4">
</video>
```

The previous example uses a `preload` attribute with a value of `none` to prevent browsers from preloading _any_ video data. The `poster` attribute gives the `<video>` element a placeholder that will occupy the space while the video loads.

This can be further enhanced to preload the metadata when the user hovers the video with an `onmouseenter` attribute (or with the equivalent `mouseenter` event handler):

```html
<video controls
  preload="none"
  poster="one-does-not-simply-placeholder.jpg"
  onmouseenter="event.target.setAttribute('preload','metadata')">
  <source src="one-does-not-simply.webm" type="video/webm">
  <source src="one-does-not-simply.mp4" type="video/mp4">
</video>
```

Videos can qualify as an [LCP candidates](/articles/lcp#what-elements-are-considered"). A `poster` image will be quicker to load than the video so where this is an LCP candidate, you should use a poster image, but also [preload it](/articles/preload-critical-assets) with a [`fetchpriority` attribute value of `"high"`](/articles/fetch-priority#the_fetchpriority_attribute):

```html
<link rel="preload" href="one-does-not-simply-placeholder.jpg" as="image" fetchpriority="high">
<video controls preload="none"
  poster="one-does-not-simply-placeholder.jpg"
  onmouseenter="event.target.setAttribute('preload','metadata')">
  <source src="one-does-not-simply.webm" type="video/webm">
  <source src="one-does-not-simply.mp4" type="video/mp4">
</video>
```

## For video acting as an animated GIF replacement {: #video-gif-replacement }

Autoplaying videos are most commonly used for GIF-style quick animations. While animated GIFs enjoy wide use, they're subpar to video equivalents in a number of ways, particularly in file size. Animated GIFs can stretch into the range of several megabytes of data. Videos of similar visual quality tend to be far smaller.

Achieving this with the `<video>` element looks something like this:

```html
<video autoplay muted loop playsinline>
  <source src="one-does-not-simply.webm" type="video/webm">
  <source src="one-does-not-simply.mp4" type="video/mp4">
</video>
```

The `autoplay`, `muted`, and `loop` attributes are self-explanatory. [`playsinline` is necessary for autoplaying to occur in iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/). Now you have a serviceable video-as-GIF replacement that works across platforms. But how to go about lazy loading it? To start, modify your `<video>` markup accordingly:

```html
<video class="lazy" autoplay muted loop playsinline width="610" height="254" poster="one-does-not-simply.jpg">
  <source data-src="one-does-not-simply.webm" type="video/webm">
  <source data-src="one-does-not-simply.mp4" type="video/mp4">
</video>
```

You'll notice the addition of the [`poster` attribute](https://developer.mozilla.org/docs/Web/HTML/Element/video#attr-poster), which lets you specify a placeholder to occupy the `<video>` element's space until the video is lazy-loaded. As with the [`<img>` lazy-loading examples](/articles/lazy-loading-images), stash the video URL in the `data-src` attribute on each `<source>` element. From there, use JavaScript code similar to the Intersection Observer-based image lazy loading examples:

```javascript
document.addEventListener("DOMContentLoaded", function() {
  var lazyVideos = [].slice.call(document.querySelectorAll("video.lazy"));

  if ("IntersectionObserver" in window) {
    var lazyVideoObserver = new IntersectionObserver(function(entries, observer) {
      entries.forEach(function(video) {
        if (video.isIntersecting) {
          for (var source in video.target.children) {
            var videoSource = video.target.children[source];
            if (typeof videoSource.tagName === "string" && videoSource.tagName === "SOURCE") {
              videoSource.src = videoSource.dataset.src;
            }
          }

          video.target.load();
          video.target.classList.remove("lazy");
          lazyVideoObserver.unobserve(video.target);
        }
      });
    });

    lazyVideos.forEach(function(lazyVideo) {
      lazyVideoObserver.observe(lazyVideo);
    });
  }
});
```

When you lazy-load a `<video>` element, you need to iterate through all of the child `<source>` elements and flip their `data-src` attributes to `src` attributes. Once you've done that, you need to trigger loading of the video by calling the element's `load` method, after which the media will begin playing automatically per the `autoplay` attribute.

## Lazy loading libraries {: #libraries }

The following libraries can help you to lazy-load video:

- [vanilla-lazyload](https://github.com/verlok/vanilla-lazyload) and [lozad.js](https://github.com/ApoorvSaxena/lozad.js) are super lightweight options that use Intersection Observer only. As such, they are highly performant, but will need to be polyfilled before you can use them on older browsers.
- [yall.js](https://github.com/malchata/yall.js) is a library that uses Intersection Observer and falls back to event handlers. It can also lazy load video `poster` images using a `data-poster` attribute.
- If you need a React-specific lazy loading library, you might consider[react-lazyload](https://github.com/jasonslyvia/react-lazyload). While it doesn't use Intersection Observer, it _does_ provide a familiar method of lazy loading images for those accustomed to developing applications with React.