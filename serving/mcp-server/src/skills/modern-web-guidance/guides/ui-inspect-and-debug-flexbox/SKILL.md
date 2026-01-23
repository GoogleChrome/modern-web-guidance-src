---
description: Learn how to inspect, modify, and debug CSS flexbox layouts using Chrome DevTools.
filename: inspect-and-debug-flexbox
category: ui
---

# Inspect and debug CSS flexbox layouts

This guide shows you how to discover flexbox elements on a page, as well as inspect and modify the flexbox layouts in the **Elements** panel.

The screenshots appearing in this article are from this web page: [Centering a text element with Flexbox][1].


## Discover CSS flexbox {: #discover }

When an HTML element on your page has `display: flex` or `display: inline-flex` applied to it, you
can see a `flex` badge next to it in the [**Elements**][2] panel.

<img src="image/discover-flexbox-be605a163a192.png" alt="Discover flexbox" width="800" height="479">


## Modify layouts with the flexbox editor {: #modify }

You can modify flexbox layouts visually with the **flexbox editor**. For example, here is how you can center the text `<h1>` of this [demo page][1] within its container `<div class="container">`.

1. [Inspect](/docs/devtools/css/reference#select) the container element.
2. In the **Styles** pane, you can see the **flexbox editor** button next to the `display: flex` declaration.
  <img src="image/flexbox-editor-button-31bc20eb18986.png" alt="flexbox editor button" width="800" height="479">
3. Click on it to open the **flexbox editor**. The editor displays a list of flexbox properties. Each property's value options are displayed as icon buttons.
  <img src="image/flexbox-editor-1498c5467be09.png" alt="flexbox editor" width="800" height="752">
4. To center the text on the screen, you can click on the `justify-content: center` and `align-items: center` buttons.
  <img src="image/center-text-its-contain-36aee74962027.png" alt="Center the text in its container" width="800" height="478">
5. The text are centered now. Notice the `justify-content: center` and `align-items: center` declarations are added in the **Styles** pane.


## Examine the flexbox layout {: #examine }

You can hover over the flexbox element in the **Elements** panel to visualize the layout. The overlay appears over the
element, laid out with dotted lines to show the position of its content and items.

<img src="image/hover-a-flexbox-element-97868d0b93e3e.png" alt="hover over a flexbox element" width="800" height="479">

Alternatively, you can click on the badge to toggle the display of the flexbox overlay.

<img src="image/change-justify-content-f-c2b95dc213b96.png" alt="change justify-content to flex-end" width="800" height="479">

Try changing the value to `justify-content: flex-end`. The overlay is changed accordingly.

<img src="image/justify-content-flex-end-a1697b0a273d5.png" alt="justify-content: flex-end" width="800" height="477">

The icons in the **flex editor** are context-aware. It will change according to the layout direction. For example, when you change the `flex-direction` to `column`, the icons in the **flex editor** are rotated accordingly. The overlay is updated immediately too.

<video playsinline autoplay class="screenshot" controls loop muted > <source src="video/dPDCek3EhZgLQPGtEG3y0fTn4v82/yQv7pWSi87eatl5uiJEN.mp4" type="video/mp4" /> </video>

## Adjust the flexbox overlay color {: #layout }

Open the **Layout** pane and scroll down to the **Flexbox** section. You can view all the flexbox elements of the page here.

<img src="image/layout-pane-e777c443c70bd.png" alt="Layout pane" width="800" height="477">

You can toggle the overlay of each flexbox element with the checkbox next to it. It is the same as you click on the `badge` in the **DOM tree**.

Apart from that, you can change the color of the overlay by clicking on the color icon next to it. For example, the color of the `container` overlay is changed to black.

<img src="image/change-overlay-color-1be8fdb57efbc.png" alt="change overlay color" width="800" height="478">

To navigate to a flexbox element in the DOM tree, you can click on the selector icon next to it.

<video playsinline autoplay class="screenshot" controls loop muted > <source src="video/dPDCek3EhZgLQPGtEG3y0fTn4v82/DskcBFYnUc8zBocvXgdg.mp4" type="video/mp4" /> </video>



[1]: http://jec.fish/demo/css-flexbox
[2]: /docs/devtools/open