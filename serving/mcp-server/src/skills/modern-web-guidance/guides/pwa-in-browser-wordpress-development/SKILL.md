---
description: Enable interactive and self-contained WordPress development environments that run entirely within the browser using WebAssembly.
filename: in-browser-wordpress-development
category: pwa
---

# In-Browser WordPress Development

Reference docs:
- [WordPress Playground](https://wordpress.github.io/wordpress-playground/)
- [@wp-playground/client](https://www.npmjs.com/package/@wp-playground/client)
- [@php-wasm/web](https://www.npmjs.com/package/@php-wasm/web)

## Best Practices

Leverage WordPress Playground to create zero-setup WordPress environments that run entirely in the browser, powered by WebAssembly. This enables rapid prototyping, plugin testing, and interactive tutorials without local installations.

### Embedding WordPress Playground

You can easily embed WordPress Playground into your applications using an `<iframe>` and configuring it with query parameters. This is ideal for showcasing specific themes or plugins.

```html
<iframe
  src="https://playground.wordpress.net/?theme=pendant&plugin=coblocks"
  width="800"
  height="600"
></iframe>
```

For more advanced control, utilize the JavaScript client API. This allows programmatic interaction with the embedded WordPress instance, including filesystem manipulation, PHP execution, and plugin installation.

```js
import { connectPlayground, login, installPlugin } from '@wp-playground/client';
import { fetchZipFile } from './utils'; // Assuming a helper function to fetch plugin zip

const iframeElement = document.getElementById('wp-playground-iframe');
const client = await connectPlayground(iframeElement, {
  loadRemote: 'https://playground.wordpress.net/remote.html',
});
await client.isReady();

// Log in as admin
await login(client, 'admin', 'password');

// Install a plugin
const pluginZip = await fetchZipFile('https://example.com/path/to/your/plugin.zip');
await installPlugin(client, pluginZip);

// Run arbitrary PHP code
await client.run({ code: '<?php echo "Hello from Playground!"; ?>' });
```

### Using WebAssembly PHP Independently

The WebAssembly PHP runtime can be used on its own, outside of the full WordPress Playground environment. This is useful for adding interactive PHP snippets to web pages or for server-side logic in Node.js applications.

For web environments, use `@php-wasm/web`:

```js
import { PHP } from '@php-wasm/web';

const php = await PHP.load('8.0', {
  requestHandler: {
    documentRoot: '/www',
  },
});

php.mkdirTree('/www');
php.writeFile('/www/index.php', `<?php echo "Hello " . $_POST['name']; ?>`);
php.run({ scriptPath: '/www/index.php' });

const response = php.request({
  method: 'POST',
  relativeUrl: '/index.php',
  data: { name: 'World' },
});
console.log(response.text); // Hello World
```

For Node.js environments, utilize `@php-wasm/node` for extended functionality.

## Under the Hood

WordPress Playground achieves in-browser WordPress execution through several key components:

*   **WebAssembly PHP:** The PHP interpreter is compiled to a WebAssembly binary, allowing it to run directly in the browser.
*   **SQL Translator:** Since a WebAssembly MySQL isn't available, WordPress Playground uses SQLite and translates MySQL queries to SQLite dialect via the SQLite Database Integration plugin.
*   **In-Browser Server:** A Service Worker intercepts HTTP requests and routes them to an in-browser PHP instance running in a Web Worker, simulating a traditional server environment.
*   **WebSockets for Networking:** Enables PHP to perform network operations by proxying WebSocket connections to TCP sockets.

## Fallback Strategies

While WordPress Playground aims for a zero-setup experience, ensure users understand potential limitations or consider progressive enhancement for critical features if targeting very old browsers. However, the primary goal of WordPress Playground is to provide a highly accessible and self-contained environment, minimizing the need for traditional fallback strategies for the core functionality.

For standalone WebAssembly PHP, similar considerations for browser compatibility and polyfills may apply if targeting older environments that do not fully support WebAssembly or necessary JavaScript APIs.

## Future Possibilities

The architecture of WordPress Playground opens doors to exciting future developments, including:

*   **Zero-Setup Interactive Tutorials:** Embed fully functional WordPress sites directly within tutorials.
*   **Live Plugin Demos:** Showcase plugins in a live, interactive environment without requiring users to install them.
*   **Collaborative Development:** Enable real-time, multiplayer editing sessions for WordPress development.
*   **Seamless Deployment:** One-click deployment of creations to various hosting services.
*   **Decentralized WordPress:** Potential for running WordPress on edge servers.
*   **Mobile Development:** Building plugins directly on mobile devices.
*   **Staging Environments:** Easily spin up temporary staging sites for testing.
*   **Decentralized WordPress:** Potential for running WordPress on edge servers.

Engage with the WordPress Playground community on GitHub or the WordPress.org Slack channel (#meta-playground) to contribute to its evolution.