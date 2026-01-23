---
description: Reduce web application payload sizes using Brotli compression for improved performance and reduced bandwidth usage.
filename: brotli-compression-for-payload-reduction
category: webperf
---

# Brotli Compression for Payload Reduction

This document outlines best practices for implementing Brotli compression to minimize web application payload sizes.

## Dynamic Compression with Node.js and Express

Dynamic compression involves compressing assets on-the-fly as they are requested by the browser. This is particularly useful for dynamically generated web pages.

### Advantages

*   No need to create and update saved compressed versions of assets.
*   Works well for dynamically generated web pages.

### Disadvantages

*   Compressing files at higher levels to achieve better compression ratios takes longer, potentially impacting server performance.

### Implementation

1.  **Install `shrink-ray`:**
    Add `shrink-ray` as a `devDependency` in your `package.json`:

    ```json
    "devDependencies": {
      "shrink-ray": "^0.1.3"
    }
    ```

2.  **Integrate `shrink-ray` into `server.js`:**
    Import and use `shrink-ray` as middleware before `express.static`:

    ```js
    const express = require('express');
    const shrinkRay = require('shrink-ray');
    const app = express();

    // Compress all requests
    app.use(shrinkRay());
    app.use(express.static('public'));

    const listener = app.listen(process.env.PORT, function() {
      console.log(`Your app is listening on port ${listener.address().port}`);
    });
    ```

3.  **Verify Compression:**
    Reload the app and check the Network tab in Chrome DevTools. You should see `brotli` (indicated by `br`) in the `Content-Encoding` header, and the bundle size should be significantly reduced compared to uncompressed or gzip-compressed assets.

**Note on Brotli Quality:** Brotli offers eleven quality levels (0-9). `shrink-ray` defaults to quality 4, which is generally suitable for dynamic content. You can adjust this by passing an `options` object to `shrinkRay([options])`.

## Static Compression with Node.js, Express, and Webpack

Static compression involves compressing files ahead of time during the build process.

### Advantages

*   No on-the-fly compression latency, as files are already compressed.
*   Assets can be fetched directly.

### Disdisadvantages

*   Assets need to be compressed with every build, potentially increasing build times significantly, especially with high compression levels.

### Implementation

1.  **Install `brotli-webpack-plugin`:**
    Add `brotli-webpack-plugin` as a `devDependency` in your `package.json`:

    ```json
    "devDependencies": {
      "brotli-webpack-plugin": "^1.1.0"
    }
    ```

2.  **Configure Webpack:**
    Import and include `brotli-webpack-plugin` in your `webpack.config.js`:

    ```js
    var path = require("path");
    var BrotliPlugin = require('brotli-webpack-plugin');

    module.exports = {
      // ...
      plugins: [
        // ...
        new BrotliPlugin({
          asset: '[file].br', // Appends .br to the compressed file name
          test: /\.(js|css|html)$/ // Process specified asset types
        })
      ]
    }
    ```
    This configuration will create `.br` versions of your assets (e.g., `main.js` becomes `main.js.br`).

3.  **Configure Server to Serve Compressed Files:**
    Modify `server.js` to check for `Accept-Encoding: br` and serve the `.br` files accordingly.

    ```js
    const express = require('express');
    const app = express();

    app.get('*.js', (req, res, next) => {
      if (req.header('Accept-Encoding') && req.header('Accept-Encoding').includes('br')) {
        req.url = req.url + '.br';
        res.set('Content-Encoding', 'br');
        res.set('Content-Type', 'application/javascript; charset=UTF-8');
      }
      next();
    });

    // Add similar routes for other asset types like CSS and HTML if needed.

    app.use(express.static('public'));

    const listener = app.listen(process.env.PORT, function() {
      console.log(`Your app is listening on port ${listener.address().port}`);
    });
    ```

4.  **Verify Compression:**
    After the app reloads and rebuilds, inspect the Network panel in Chrome DevTools. You should see the Brotli-compressed assets being served, with a significant reduction in size.

**Note on Browser Support:** Brotli is supported in all modern browsers. Browsers that support Brotli will include `br` in their `Accept-Encoding` request headers. The server-side logic ensures that Brotli-compressed files are only sent to capable browsers.

## Conclusion

Brotli compression offers a significant advantage over `gzip` for reducing web application payload sizes, leading to faster load times and reduced bandwidth consumption. Whether you choose dynamic or static compression depends on your application's architecture and deployment strategy. Always consider checking if your CDN or hosting platform offers Brotli support before manual implementation.