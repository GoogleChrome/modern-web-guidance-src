---
description: Bundle HTML, CSS, and JavaScript into a single distributable resource for easier code organization and dependency management.
filename: bundling-and-distributing-web-components
category: extensions
---

# Bundling and Distributing Web Components

HTML Imports offer a powerful way to package related HTML, CSS, and JavaScript into a single, self-contained resource. This simplifies distribution, promotes code organization, and aids in dependency management.

## Best Practices

### Bundling Resources

When creating reusable components or libraries, bundle all necessary assets (HTML, CSS, JS, fonts, etc.) into a single HTML file. This provides a single URL for consumers, abstracting away the complexity of individual files.

```html
<head>
    <link rel="import" href="bootstrap.html">
</head>
```

The `bootstrap.html` file would contain all the necessary elements:

```html
<link rel="stylesheet" href="bootstrap.css">
<link rel="stylesheet" href="fonts.css">
<script src="jquery.js"></script>
<script src="bootstrap.js"></script>
<!-- ... other resources -->
<template>
    <!-- Component markup -->
</template>
```

### Delivering Web Components

HTML Imports are ideal for distributing Web Components, including HTML `<template>` elements and custom elements with Shadow DOM.

**Including Templates:**

Wrap markup in a `<template>` tag within your import. The content remains inert until explicitly added to the DOM.

```html
<!-- import.html -->
<template>
    <h1>Hello World!</h1>
    <img src="world.png">
    <script>alert("Executed when the template is activated.");</script>
</template>
```

```html
<!-- index.html -->
<head>
    <link rel="import" href="import.html">
</head>
<body>
    <div id="container"></div>
    <script>
    var link = document.querySelector('link[rel="import"]');
    var template = link.import.querySelector('template');
    var clone = document.importNode(template.content, true);
    document.querySelector('#container').appendChild(clone);
    </script>
</body>
```

**Registering Custom Elements:**

Define and register custom elements within an HTML import. This allows users to declare and use your components without manual setup.

```html
<!-- elements.html -->
<script>
    // Define and register <say-hi>.
    var proto = Object.create(HTMLElement.prototype);
    proto.createdCallback = function() {
        this.innerHTML = 'Hello, <b>' + (this.getAttribute('name') || '?') + '</b>';
    };
    document.registerElement('say-hi', {prototype: proto});
</script>

<template id="t">
    <style>...</style>
    <span>I'm a shadow-element using Shadow DOM!</span>
    <content></content>
</template>

<script>
    // Define and register <shadow-element>
    var proto2 = Object.create(HTMLElement.prototype);
    proto2.createdCallback = function() {
        var template = document.currentScript.ownerDocument.querySelector('#t');
        var clone = document.importNode(template.content, true);
        var root = this.createShadowRoot();
        root.appendChild(clone);
    };
    document.registerElement('shadow-element', {prototype: proto2});
</script>
```

```html
<!-- index.html -->
<head>
    <link rel="import" href="elements.html">
</head>
<body>
    <say-hi name="Eric"></say-hi>
    <shadow-element>
        <div>( I'm in the light dom )</div>
    </shadow-element>
</body>
```

### Managing Dependencies and Sub-imports

HTML Imports automatically de-duplicate resources. If multiple imports reference the same URL, the resource is fetched and processed only once.

**Sub-imports:** An import can include other imports to build layered components.

```html
<!-- paper-tabs.html -->
<link rel="import" href="iron-selector.html">
<link rel="import" href="classes/iron-flex-layout.html">
<!-- ... -->
```

**Dependency Management:** Wrap libraries like jQuery in an HTML import to ensure they are loaded and executed only once across your application.

```html
<!-- jquery.html -->
<script src="http://cdn.com/jquery.js"></script>
```

Other imports can then reference `jquery.html`:

```html
<!-- ajax-element.html -->
<link rel="import" href="jquery.html">
<script>
    // Use jQuery
    var proto = Object.create(HTMLElement.prototype);
    proto.makeRequest = function(url, done) {
        return $.ajax(url).done(function() {
            done();
        });
    };
    document.registerElement('ajax-element', {prototype: proto});
</script>
```

## Performance Considerations

### Concatenate Imports

Use build tools like [Vulcanize](https://github.com/Polymer/vulcanize) to flatten multiple top-level imports into a single file, reducing network requests.

### Leverage Browser Caching

Browser caching is automatically utilized for imported resources, improving load times for repeat visits.

### Asynchronous Loading

*   **Blocking Rendering:** By default, imports can block rendering like stylesheets. Use the `async` attribute for asynchronous loading to prevent blocking the main page's parser and rendering.

    ```html
    <link rel="import" href="/path/to/import.html" async>
    ```
*   **Non-blocking Parsing:** Imports themselves do not block the main page's parsing. Scripts within imports are processed in order but do not halt the main document's progress, offering defer-like behavior.
*   **Script Placement:** For optimal performance, place scripts that depend on imported content towards the end of the `<body>` or dynamically load imports.

    **Preferred:** Place scripts at the end of the `<body>`.

    ```html
    <body>
        <div id="container"></div>
        <script>
            var link = document.querySelector('link[rel="import"]');
            var post = link.import.querySelector('#blog-post');
            document.querySelector('#container').appendChild(post.cloneNode(true));
        </script>
    </body>
    ```

    **Alternative (dynamic import):** Dynamically add the `<link rel="import">` tag to avoid blocking rendering if scripts are present in the `<head>`.

    ```html
    <head>
        <script>
        function addImportLink(url) {
            var link = document.createElement('link');
            link.rel = 'import';
            link.href = url;
            link.onload = function(e) { /* ... */ };
            document.head.appendChild(link);
        }
        addImportLink('/path/to/import.html');
        </script>
        <script>/* other scripts */</script>
    </head>
    ```

## Key Takeaways

*   An import's MIME type is `text/html`.
*   Resources from other origins must be CORS-enabled.
*   Imported resources are de-duplicated.
*   Scripts in imports execute at import time but do not block main document parsing.
*   Markup and other resources from imports must be explicitly added to the main page, unlike `<style>` tags which apply automatically.
*   HTML Imports enable parallel HTML parsing, a first for the web platform.